import os
import cv2
import numpy as np
import base64
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, render_template, Response, send_from_directory
from deepface import DeepFace
from scipy.spatial.distance import cosine
from pymongo import MongoClient
from bson import ObjectId
from gridfs import GridFS
from urllib.parse import quote_plus
from pymongo.server_api import ServerApi
from io import BytesIO
from dotenv import load_dotenv
import uuid
from flask_cors import CORS  # already present, skip if duplicate
from dotenv import load_dotenv  # already present, skip if duplicate
from pymongo.server_api import ServerApi  # already present
import face_recognition
import numpy as np
from PIL import Image
import base64
from io import BytesIO
# Load environment variables
load_dotenv()

app = Flask(__name__, static_folder="static")
CORS(app)

# Serve React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Enhanced Model Configuration
MODELS = {
    "ArcFace": {
        "threshold": 0.35,
        "model": None,
        "enabled": True
    },
    "Facenet": {
        "threshold": 0.40,
        "model": None,
        "enabled": True
    },
    "Facenet512": {
        "threshold": 0.30,
        "model": None,
        "enabled": True
    },
    "VGG-Face": {
        "threshold": 0.50,
        "model": None,
        "enabled": False  # Disabled by default as it's less accurate
    },
    "DeepFace": {
        "threshold": 0.35,
        "model": None,
        "enabled": True
    },
    "SFace": {
        "threshold": 0.30,
        "model": None,
        "enabled": True  # New high-accuracy model
    }
}

# Initialize models
for model_name, config in MODELS.items():
    if config["enabled"]:
        try:
            MODELS[model_name]["model"] = DeepFace.build_model(model_name)
            print(f"Initialized {model_name} model successfully")
        except Exception as e:
            print(f"Error initializing {model_name}: {str(e)}")
            MODELS[model_name]["enabled"] = False

# MongoDB Atlas Connection
def get_mongo_client():
    try:
        username = quote_plus(os.getenv("MONGO_USERNAME", "campustechnology"))
        password = quote_plus(os.getenv("MONGO_PASSWORD", ""))
        cluster_url = os.getenv("MONGO_CLUSTER", "cluster0.ns6jg36.mongodb.net")
        
        if not password:
            raise ValueError("MongoDB password not configured")

        uri = f"mongodb+srv://{username}:{password}@{cluster_url}/?retryWrites=true&w=majority&appName=Cluster0"
        
        client = MongoClient(
            uri,
            server_api=ServerApi('1'),
            connectTimeoutMS=5000,
            socketTimeoutMS=30000,
            serverSelectionTimeoutMS=5000
        )
        
        client.admin.command('ping')
        print("Successfully connected to MongoDB Atlas!")
        return client
        
    except Exception as e:
        print(f"Failed to connect to MongoDB: {str(e)}")
        raise

# Initialize MongoDB
try:
    client = get_mongo_client()
    db = client["face_recognition_db"]
    fs = GridFS(db)
except Exception as e:
    print(f"Critical MongoDB connection error: {str(e)}")
    # In production, you might want to exit here
    # import sys; sys.exit(1)

# Initialize collections and indexes
def initialize_database():
    required_collections = ["participants", "face_embeddings", "attendance", "events"]
    
    for collection in required_collections:
        if collection not in db.list_collection_names():
            db.create_collection(collection)
            print(f"Created collection: {collection}")
    
    db.participants.create_index("name", unique=True)
    db.face_embeddings.create_index("name", unique=True)
    db.attendance.create_index([("name", 1), ("event", 1), ("timestamp", 1)])
    print("Database initialized successfully")

initialize_database()

# Helper Functions
def base64_to_cv2(image_data):
    """Convert base64 image to OpenCV format"""
    try:
        header, encoded = image_data.split(',', 1)
        img_bytes = base64.b64decode(encoded)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Invalid image data")
        return img
    except Exception as e:
        raise ValueError(f"Image processing failed: {str(e)}")

def cv2_to_base64(image):
    """Convert OpenCV image to base64"""
    _, buffer = cv2.imencode('.jpg', image)
    return f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

def verify_image(img):
    """Ensure image is in correct format for processing"""
    if img.dtype != np.uint8:
        img = (img * 255).astype(np.uint8) if img.max() <= 1.0 else img.astype(np.uint8)
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    return img

def extract_faces(image):
    """Detect faces in image using multiple detectors with enhanced parameters"""
    detectors = ["retinaface", "mtcnn"]  # Removed opencv as it's less accurate
    
    for detector in detectors:
        try:
            faces = DeepFace.extract_faces(
                img_path=image,
                detector_backend=detector,
                enforce_detection=True,
                align=True,
                expand_percentage=15,  # Increased from 10 to capture more context
                grayscale=False
            )
            
            valid_faces = []
            for face in faces:
                if face['confidence'] > 0.95:  # Increased confidence threshold
                    face_img = verify_image(face['face'])
                    valid_faces.append({
                        'face': face_img,
                        'area': face['facial_area'],
                        'confidence': face['confidence']
                    })
            
            if valid_faces:
                print(f"Found {len(valid_faces)} faces using {detector} detector")
                return valid_faces
                
        except Exception as e:
            print(f"Error with {detector} detector: {str(e)}")
            continue
    
    return []

def get_embeddings(image, model_name):
    """Get face embeddings using specified model"""
    try:
        embedding = DeepFace.represent(
            img_path=image,
            model_name=model_name,
            enforce_detection=False,
            detector_backend="skip"  # We already extracted faces
        )
        return embedding[0]["embedding"]
    except Exception as e:
        print(f"Error getting {model_name} embedding: {str(e)}")
        return None

def load_known_faces():
    """Load face embeddings from MongoDB with enhanced caching"""
    known = {}
    for model_name, config in MODELS.items():
        if config["enabled"]:
            known[model_name] = []
            for doc in db.face_embeddings.find({}, {"embeddings." + model_name: 1, "name": 1}):
                if model_name in doc.get("embeddings", {}):
                    known[model_name].append((doc["name"], doc["embeddings"][model_name]))
    
    return known

def match_faces(image):
    """Enhanced face matching with multiple models and voting system"""
    known_faces = load_known_faces()
    faces = extract_faces(image)
    
    if not faces:
        return []
    
    results = []
    for face in faces:
        model_votes = {}
        
        for model_name, config in MODELS.items():
            if not config["enabled"]:
                continue
                
            try:
                embedding = get_embeddings(face['face'], model_name)
                if not embedding:
                    continue
                
                best_name = "Unknown"
                best_score = float('inf')
                
                for name, known_emb in known_faces[model_name]:
                    score = cosine(embedding, known_emb)
                    if score < best_score:
                        best_score = score
                        best_name = name
                
                confidence = 1 - best_score
                if confidence > config["threshold"]:
                    if best_name not in model_votes:
                        model_votes[best_name] = {"count": 0, "total_conf": 0, "models": []}
                    
                    model_votes[best_name]["count"] += 1
                    model_votes[best_name]["total_conf"] += confidence
                    model_votes[best_name]["models"].append(model_name)
                    
            except Exception as e:
                print(f"Error processing {model_name}: {str(e)}")
                continue
        
        if model_votes:
            # Enhanced voting: consider both count and average confidence
            best_match = max(model_votes.items(), 
                           key=lambda x: (x[1]["count"], x[1]["total_conf"]))
            
            avg_conf = best_match[1]["total_conf"] / best_match[1]["count"]
            used_models = ", ".join(best_match[1]["models"])
            
            results.append({
                "name": best_match[0],
                "confidence": avg_conf,
                "bbox": face['area'],
                "models": used_models,
                "detection_confidence": face['confidence']
            })
        else:
            results.append({
                "name": "Unknown",
                "confidence": 0,
                "bbox": face['area'],
                "models": "",
                "detection_confidence": face['confidence']
            })
    
    return results

def annotate_image(img, results):
    """Draw enhanced annotations on image"""
    for res in results:
        bbox = res['bbox']
        color = (0, 255, 0) if res['name'] != "Unknown" else (0, 0, 255)
        
        # Draw bounding box
        cv2.rectangle(img, (bbox['x'], bbox['y']),
                     (bbox['x'] + bbox['w'], bbox['y'] + bbox['h']), color, 2)
        
        # Draw label with confidence and models
        label = f"{res['name']} ({res['confidence']:.0%})"
        if res['models']:
            label += f" [{res['models']}]"
        
        cv2.putText(img, label,
                   (bbox['x'], bbox['y'] - 10),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    
    return img


client = get_mongo_client()
db = client["face_recognition_db"]
fs = GridFS(db)

# Add this line to access login collection
users_collection = db["students"]

# Routes

@app.route('/api/identify', methods=['POST'])
def identify_faces():
    try:
        image_data = request.json.get('image', '')
        if not image_data.startswith('data:image'):
            return jsonify({"error": "Invalid image data"}), 400

        img = base64_to_cv2(image_data)
        results = match_faces(img)
        
        if not results:
            return jsonify({"status": "no_faces"})

        # Annotate image
        annotated_img = annotate_image(img.copy(), results)
        annotated_image = cv2_to_base64(annotated_img)

        # Get participant details for known faces
        people_data = []
        unknown_faces = []
        
        for res in results:
            if res["name"] != "Unknown":
                person = db.participants.find_one({"name": res["name"]})
                if person:
                    people_data.append({
                        "name": res["name"],
                        "email": person.get("email", ""),
                        "phone": person.get("phone", ""),
                        "registered_on": person.get("registered_at", ""),
                        "attendance": person.get("attendance", []),
                        "class": person.get("class", ""),
                        "program": person.get("program", ""),
                        "program_code": person.get("program_code", ""),
                        "course": person.get("course", ""),
                        "course_code": person.get("course_code", ""),
                        "attendance_percentage": person.get("attendance_percentage", ""),
                        "confidence": float(res["confidence"]),
                        "bbox": res["bbox"],
                        "models": res["models"],
                        "detection_confidence": res["detection_confidence"]
                    })

            else:
                unknown_faces.append({
                    "id": f"face_{len(unknown_faces) + 1}",
                    "confidence": float(res["confidence"]),
                    "bbox": res["bbox"],
                    "detection_confidence": res["detection_confidence"]
                })

        return jsonify({
            "status": "success",
            "known_faces": people_data,
            "unknown_faces": unknown_faces,
            "annotated_image": annotated_image,
            "original_image": image_data  # Return original for comparison
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print("Error identifying face:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/api/events', methods=['GET'])
def get_events():
    try:
        events = list(db.events.find({}, {"_id": 0}))
        return jsonify({
            "status": "success",
            "events": events
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/register', methods=['POST'])
def register_face():
    try:
        data = request.json
        name = data.get('name', '').strip()
        image_data = data.get('image', '')
        
        if not name:
            return jsonify({"error": "Name is required"}), 400
        if not image_data.startswith('data:image'):
            return jsonify({"error": "Invalid image data"}), 400

        # Check if name exists
        if db.participants.count_documents({"name": name}) > 0:
            return jsonify({"error": "Name already registered"}), 400

        # Process image
        img = base64_to_cv2(image_data)
        faces = extract_faces(img)
        
        if not faces:
            return jsonify({"error": "No faces detected in image"}), 400
        if len(faces) > 1:
            return jsonify({"error": "Multiple faces detected. Please upload image with one clear face"}), 400

        # Generate embeddings for all enabled models
        embeddings = {}
        for model_name, config in MODELS.items():
            if config["enabled"]:
                embedding = get_embeddings(faces[0]['face'], model_name)
                if embedding:
                    embeddings[model_name] = embedding

        if not embeddings:
            return jsonify({"error": "Could not generate face embeddings"}), 400

        # Store image in GridFS
        file_id = fs.put(base64.b64decode(image_data.split(',')[1]), 
                       filename=name, 
                       content_type="image/jpeg")

        # Create participant record
        participant = {
            "name": name,
            "image_id": str(file_id),
            "registered_at": datetime.now(),
            "attendance": []
        }
        participant["email"] = data.get("email", "").strip()
        participant["phone"] = data.get("phone", "").strip()
        participant["class"] = data.get("class", "").strip()
        participant["program"] = data.get("program", "").strip()
        participant["program_code"] = data.get("program_code", "").strip()
        participant["course"] = data.get("course", "").strip()
        participant["course_code"] = data.get("course_code", "").strip()
        participant["faculty"] = data.get("faculty", "").strip()
        participant["facultyid"] = data.get("faculty_id", "").strip()
        participant["period"] = data.get("period", "").strip()
        participant["attendance_percentage"] = data.get("attendance_percentage")

        if 'email' in data:
            participant['email'] = data['email'].strip()
        if 'phone' in data:
            participant['phone'] = data['phone'].strip()

        # Store in database
        db.participants.insert_one(participant)
        db.face_embeddings.insert_one({
            "name": name,
            "embeddings": embeddings,
            "updated_at": datetime.now()
        })

        return jsonify({
            "status": "success",
            "message": f"{name} registered successfully",
            "face_detection_confidence": faces[0]['confidence']
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/register_unknown', methods=['POST'])
def register_unknown_face():
    try:
        data = request.json
        name = data.get('name', '').strip()
        face_id = data.get('face_id', '')
        image_data = data.get('image', '')
        
        if not name or not face_id or not image_data:
            return jsonify({"error": "Name, face ID and image are required"}), 400

        # Process image
        img = base64_to_cv2(image_data)
        
        # Find the face in the image
        faces = extract_faces(img)
        face_data = None
        
        # Simple face matching by position (for demo - in production use better matching)
        for face in faces:
            if f"face_{faces.index(face) + 1}" == face_id:
                face_data = face
                break
        
        if not face_data:
            return jsonify({"error": "Face not found"}), 404

        # Generate embeddings
        embeddings = {}
        for model_name, config in MODELS.items():
            if config["enabled"]:
                embedding = get_embeddings(face_data['face'], model_name)
                if embedding:
                    embeddings[model_name] = embedding

        if not embeddings:
            return jsonify({"error": "Could not generate face embeddings"}), 400

        # Store in database
        participant = {
            "name": name,
            "registered_at": datetime.now(),
            "attendance": [],
            "email": data.get("email", "").strip(),
            "phone": data.get("phone", "").strip(),
            "class": data.get("class", "").strip(),
            "program": data.get("program", "").strip(),
            "program_code": data.get("program_code", "").strip(),
            "course": data.get("course", "").strip(),
            "course_code": data.get("course_code", "").strip(),
            "faculty": data.get("faculty", "").strip(),
            "facultyid": data.get("faculty_id", "").strip(),
            "period": data.get("period", "").strip(),
            "attendance_percentage": data.get("attendance_percentage")
        }

        db.participants.insert_one(participant)
        db.face_embeddings.insert_one({
            "name": name,
            "embeddings": embeddings,
            "updated_at": datetime.now()
        })

        return jsonify({
            "status": "success",
            "message": f"{name} registered successfully",
            "face_detection_confidence": face_data['confidence']
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/mark_attendance', methods=['POST'])
def mark_attendance():
    try:
        data = request.json
        name = data.get("name", "").strip()
        event = data.get("event", "").strip()
        
        if not name or not event:
            return jsonify({"error": "Name and event are required"}), 400

        # Find participant
        participant = db.participants.find_one({"name": name})
        if not participant:
            return jsonify({"error": "Participant not found"}), 404

        # Check for existing attendance
        existing = db.attendance.find_one({
            "name": name,
            "event": event,
            "timestamp": {
                "$gte": datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            }
        })
        
        if existing:
            return jsonify({
                "status": "success",
                "message": f"Attendance already marked for {name} at {event} today"
            })

        # Create attendance record
        attendance_record = {
            "name": name,
            "event": event,
            "timestamp": datetime.now(),
            "participant_id": participant["_id"]
        }

        db.attendance.insert_one(attendance_record)
        
        # Update participant's attendance record
        db.participants.update_one(
            {"_id": participant["_id"]},
            {"$push": {"attendance": {
                "event": event,
                "timestamp": datetime.now()
            }}}
        )

        return jsonify({
            "status": "success",
            "message": f"Attendance marked for {name} at {event}"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/participants', methods=['GET'])
def get_participants():
    try:
        participants = []
        for doc in db.participants.find({}, {
            "name": 1,
            "email": 1,
            "phone": 1,
            "registered_at": 1,
            "image_id": 1
        }):
            participant = {
                "name": doc.get("name"),
                "email": doc.get("email", ""),
                "phone": doc.get("phone", ""),
                "registered_at": doc.get("registered_at"),
            }

            # 🟢 Add image URL if present
            if "image_id" in doc:
                participant["image"] = f"/image/{doc['image_id']}"

            # 🔍 Dynamically fetch attendance from attendance collection
            attendance = list(db.attendance.find(
                {"name": doc.get("name")},
                {"_id": 0, "event": 1, "timestamp": 1}
            ).sort("timestamp", -1))

            participant["attendance"] = attendance
            participants.append(participant)

        return jsonify({
            "status": "success",
            "participants": participants,
            "count": len(participants)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/participants/<name>', methods=['DELETE'])
def delete_participant(name):
    try:
        result = db.participants.delete_one({"name": name})
        if result.deleted_count == 1:
            db.face_embeddings.delete_one({"name": name})
            return jsonify({
                "status": "success",
                "message": f"Participant {name} deleted"
            })
        else:
            return jsonify({"error": "Participant not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/image/<image_id>')
def get_image(image_id):
    try:
        file = fs.get(ObjectId(image_id))
        return Response(file.read(), mimetype='image/jpeg')
    except Exception as e:
        print(f"Image fetch error: {str(e)}")
        return f"Image not found: {str(e)}", 404

@app.route('/api/events', methods=['GET', 'POST'])
def manage_events():
    if request.method == 'GET':
        try:
            events = list(db.events.find({}, {"_id": 0}))
            return jsonify({
                "status": "success",
                "events": events
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.json
            event_name = data.get('name', '').strip()
            event_date = data.get('date', '').strip()
            event_time = data.get('time', '').strip()
            location = data.get('location', '').strip()
            faculty = data.get('faculty', '').strip()
            facultyid = data.get('facultyid', '').strip()
            period = data.get('period', '').strip()

            if not event_name or not event_date or not event_time or not location:
                return jsonify({"error": "Missing required fields"}), 400

            if db.events.count_documents({"name": event_name}) > 0:
                return jsonify({"error": "Event already exists"}), 400

            db.events.insert_one({
                "name": event_name,
                "date": event_date,
                "time": event_time,
                "location": location,
                "faculty": faculty,
                "facultyid": facultyid,
                "period": period,
                "created_at": datetime.now()
            })
            
            return jsonify({
                "status": "success",
                "message": "Event created successfully"
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/api/events/<name>', methods=['DELETE'])
def delete_event(name):
    try:
        result = db.events.delete_one({"name": name})
        if result.deleted_count == 1:
            return jsonify({
                "status": "success",
                "message": "Event deleted successfully"
            })
        else:
            return jsonify({"error": "Event not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    try:
        event = request.args.get('event', '')
        date = request.args.get('date', '')
        
        query = {}
        if event:
            query["event"] = event
        if date:
            query["timestamp"] = {
                "$gte": datetime.strptime(date, "%Y-%m-%d"),
                "$lt": datetime.strptime(date, "%Y-%m-%d") + timedelta(days=1)
            }
        
        attendance_cursor = db.attendance.find(query, {
            "name": 1,
            "event": 1,
            "timestamp": 1,
            "_id": 1
        }).sort("timestamp", -1)

        attendance = []

        for record in attendance_cursor:
            record['_id'] = str(record['_id'])  # convert ObjectId to string
            attendance.append(record)
        
        return jsonify({
            "status": "success",
            "attendance": attendance,
            "count": len(attendance)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/attendance/<id>', methods=['DELETE'])
def delete_attendance_record(id):
    try:
        # First get the record to update participant's attendance
        record = db.attendance.find_one({"_id": ObjectId(id)})
        if not record:
            return jsonify({"error": "Attendance record not found"}), 404
        
        # Delete from attendance collection
        result = db.attendance.delete_one({"_id": ObjectId(id)})
        if result.deleted_count == 1:
            # Remove from participant's attendance array
            db.participants.update_one(
                {"name": record["name"]},
                {"$pull": {"attendance": {"event": record["event"], "timestamp": record["timestamp"]}}}
            )
            
            return jsonify({
                "status": "success",
                "message": "Attendance record deleted"
            })
        else:
            return jsonify({"error": "Attendance record not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/test_db', methods=['GET'])
def test_db_connection():
    try:
        # Test connection
        db.command('ping')
        
        # Get counts
        participants_count = db.participants.count_documents({})
        embeddings_count = db.face_embeddings.count_documents({})
        events_count = db.events.count_documents({})
        attendance_count = db.attendance.count_documents({})
        
        return jsonify({
            "status": "success",
            "message": "Database connection working",
            "collections": db.list_collection_names(),
            "counts": {
                "participants": participants_count,
                "embeddings": embeddings_count,
                "events": events_count,
                "attendance": attendance_count
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/register_user", methods=["POST"])
def register_user():
    data = request.get_json()
    image_data = data.get("image")

    if not image_data:
        return jsonify({"error": "Image data is required"}), 400

    # Decode the base64 image
    try:
        header, encoded = image_data.split(",", 1)
        decoded = base64.b64decode(encoded)

        img = Image.open(BytesIO(decoded)).convert("RGB")
        img_np = np.array(img)

        # Generate face encodings
        face_encodings = face_recognition.face_encodings(img_np)
        if not face_encodings:
            return jsonify({"error": "No face detected in the image"}), 400

        encoding_list = face_encodings[0].tolist()
    except Exception as e:
        return jsonify({"error": f"Failed to process image: {str(e)}"}), 400

    # Build user document
    user_data = {
        "email": data["email"],
        "name": data["name"],
        "phone": data["phone"],
        "password": data["password"],
        "role": data["role"],
        "regno": data["regno"],
        "programcode": data["programcode"],
        "admissionyear": data["admissionyear"],
        "semester": data["semester"],
        "section": data["section"],
        "gender": data.get("gender"),
        "department": data["department"],
        "category": data.get("category"),
        "address": data.get("address"),
        "quota": data.get("quota"),
        "colid": data.get("colid"), 
        "status": data["status"],
        "status1": data["status1"],
        "photo": image_data,          # Optional: keep base64 for preview
        "face_encoding": encoding_list,  # IMPORTANT: store encoding here
        "created_at": datetime.utcnow().isoformat()
    }

    users_collection.insert_one(user_data)

    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login_face", methods=["POST"])
def login_face():
    data = request.json
    image_data = data.get("image")
    
    if not image_data:
        return jsonify({"error": "Missing image"}), 400

    try:
        # Decode base64 image
        header, encoded = image_data.split(",", 1)
        decoded = base64.b64decode(encoded)
        img = Image.open(BytesIO(decoded)).convert("RGB")
        img_np = np.array(img)

        # Generate face encodings
        face_encodings = face_recognition.face_encodings(img_np)
        if not face_encodings:
            return jsonify({"error": "No face detected in the image"}), 404

        captured_encoding = face_encodings[0]

        # Check against all stored encodings
        for user in users_collection.find():
            stored_encoding = user.get("face_encoding")
            if not stored_encoding:
                continue

            match = face_recognition.compare_faces(
                [np.array(stored_encoding)],
                captured_encoding,
                tolerance=0.45  # you can adjust this threshold
            )

            if match[0]:
                user["_id"] = str(user["_id"])
                return jsonify(user), 200

        return jsonify({"error": "No matching user found"}), 404

    except Exception as e:
        print("Login error:", str(e))
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)