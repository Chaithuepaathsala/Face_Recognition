from flask import Flask, request, jsonify
from flask_cors import CORS
from db import users_collection
from face_utils import decode_base64_image
import base64
from datetime import datetime
from pymongo import MongoClient
import uuid
from dotenv import load_dotenv
from pymongo.server_api import ServerApi
import os
app = Flask(__name__)
CORS(app)

#client = MongoClient("mongodb://localhost:27017/")
#db = client["faceauthorization"]
#
load_dotenv()  # Must be called before reading os.getenv

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
db = client[DB_NAME]
users_collection = db["students"]

@app.route("/register_user", methods=["POST"])
def register_user():
    data = request.get_json()

#required_fields = [
#    "name","email", "password", "phone",  "role", "regno", "programcode",
#    "admissionyear", "semester", "section",  "department",
#    "category", "address", "quota", "status","gender", "image"
#]

#missing_fields = [field for field in required_fields if not data.get(field)]
#if missing_fields:
#    return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400

# Generate colid
    
    #colid = str(uuid.uuid4())

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
        #"user": data.get("user"),
        #"status": data.get("status"),
        #"comments": data.get("comments"),
        #"lastlogin": data.get("lastlogin", datetime.now().isoformat()),
        "colid": str(uuid.uuid4()), 
        "status": data["status"],
        #"registered_at": datetime.now().isoformat(),
        "photo": data["image"]  # assuming image comes as base64
    }
    
    users_collection.insert_one({
        **data,
        "created_at": datetime.utcnow().isoformat()
    })
    return jsonify({"message": "User registered successfully"}), 201

@app.route("/login_face", methods=["POST"])
def login_face():
    data = request.json
    image_data = data.get("image")
    if not image_data:
        return jsonify({"error": "Missing image"}), 400

    # Dummy logic (replace with face match logic)
    user = users_collection.find_one()
    if user:
        user["_id"] = str(user["_id"])
        return jsonify(user), 200
    return jsonify({"error": "No matching user found"}), 404

if __name__ == "__main__":
    try:
        client.admin.command('ping')
        print("✅ MongoDB connected ")
    except Exception as e:
        print("❌ MongoDB connection failed:", e)

    app.run(debug=True)