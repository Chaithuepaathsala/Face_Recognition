import React, { useEffect } from 'react';

function HomePage() {
  useEffect(() => {
    // DOM Elements
        const video = document.getElementById('video');
        const canvas = document.getElementById('canvas');
        const photo = document.getElementById('photo');
        const captureBtn = document.getElementById('captureBtn');
        const identifyBtn = document.getElementById('identifyBtn');
        const registerBtn = document.getElementById('registerBtn');
        const showRegisterBtn = document.getElementById('showRegisterBtn');
        const personName = document.getElementById('personName');
        const personEmail = document.getElementById('personEmail');
        const personPhone = document.getElementById('personPhone');
        const registerForm = document.getElementById('registerForm');
        const statusDiv = document.getElementById('status');
        const resultsDiv = document.getElementById('results');
        const originalImg = document.getElementById('original-img');
        const annotatedImg = document.getElementById('annotated-img');
        const knownFacesList = document.getElementById('known-faces-list');
        const unknownFacesList = document.getElementById('unknown-faces-list');
        const eventSelect = document.getElementById('event-select');
        const markAttendanceBtn = document.getElementById('markAttendanceBtn');
        const attendanceStatus = document.getElementById('attendanceStatus');

        // Global variables
        let currentImage = null;
        let currentResults = null;

        // Initialize camera
        async function initCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 1280 }, 
                        height: { ideal: 720 } 
                    } 
                });
                video.srcObject = stream;
                setStatus("Camera ready", "success");
            } catch (err) {
                setStatus("Camera error: " + err.message, "error");
                console.error("Camera error:", err);
            }
        }

        // Set status message
        function setStatus(msg, type = 'info') {
            statusDiv.className = 'status ' + type;
            statusDiv.textContent = msg;
        }

        // Capture image from camera
        function captureImage() {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw mirror image
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Reset transformation
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            
            currentImage = canvas.toDataURL('image/jpeg');
            photo.src = currentImage;
            photo.style.display = 'block';
            originalImg.src = currentImage;
            setStatus("Image captured successfully", "success");
        }

        // Identify faces in captured image
        async function identifyFaces() {
            if (!currentImage) {
                setStatus("Please capture an image first", "error");
                return;
            }

            setStatus("Identifying faces...", "info");
            identifyBtn.disabled = true;
            
            try {
                console.log("currentImage : " + currentImage)
                const response = await fetch('/api/identify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: currentImage })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                if (data.status === 'success') {
                    currentResults = data;
                    displayResults(data);
                    loadEvents();
                    setStatus("Identification complete", "success");
                } else if (data.status === 'no_faces') {
                    setStatus("No faces detected in the image", "error");
                } else if (data.status === 'unknown_face') {
                    setStatus("Face not recognized", "error");
                }
            } catch (err) {
                setStatus("Error: " + err.message, "error");
                console.error("Identification error:", err);
            } finally {
                identifyBtn.disabled = false;
            }
        }

        // Display recognition results
        function displayResults(data) {
            resultsDiv.style.display = "block";
            annotatedImg.src = data.annotated_image || currentImage;
            
            // Display known faces
            knownFacesList.innerHTML = '';
            if (data.known_faces && data.known_faces.length > 0) {
                data.known_faces.forEach(person => {
                    const div = document.createElement('div');
                    div.className = 'person-card';
                    div.innerHTML = `
                        <h4>${person.name} (${Math.round(person.confidence * 100)}%)</h4>
                        ${person.email ? `<p>📧 ${person.email}</p>` : ''}
                        ${person.phone ? `<p>📱 ${person.phone}</p>` : ''}
                        ${person.class ? `<p>🏫 Class: ${person.class}</p>` : ''}
                        ${person.program ? `<p>📘 Program: ${person.program} (${person.program_code || ''})</p>` : ''}
                        ${person.course ? `<p>📚 Course: ${person.course} (${person.course_code || ''})</p>` : ''}
                        ${person.attendance_percentage !== undefined ? `<p>📈 Attendance %: ${person.attendance_percentage}</p>` : ''}
                        <p>🕒 Registered: ${new Date(person.registered_on).toLocaleDateString()}</p>
                    `;
                    knownFacesList.appendChild(div);
                });
            } else {
                knownFacesList.innerHTML = '<p>No recognized faces</p>';
            }
            
            // Display unknown faces
            unknownFacesList.innerHTML = '';
            if (data.unknown_faces && data.unknown_faces.length > 0) {
                data.unknown_faces.forEach(face => {
                    const div = document.createElement('div');
                    div.className = 'unknown-face';
                    div.innerHTML = `
                        <p>Unknown Face (${Math.round(face.confidence * 100)}%)</p>
                        <input type="text" id="name-${face.id}" placeholder="Enter name" required>
                        <input type="email" id="email-${face.id}" placeholder="Email (optional)">
                        <input type="tel" id="phone-${face.id}" placeholder="Phone (optional)">
                        <button onclick="registerUnknownFace('${face.id}')">Register This Person</button>
                    `;
                    unknownFacesList.appendChild(div);
                });
            } else {
                unknownFacesList.innerHTML = '<p>No unknown faces</p>';
            }
        }

        // Register a new person
        async function registerPerson() {
            const name = personName.value.trim();
            const email = personEmail.value.trim();
            const phone = personPhone.value.trim();
            
            if (!name) {
                setStatus("Name is required", "error");
                return;
            }
            
            if (!currentImage) {
                setStatus("Capture image before registering", "error");
                return;
            }

            setStatus("Registering person...", "info");
            registerBtn.disabled = true;
            
            try {
                const data = { 
                    name, 
                    image: currentImage 
                };
                
                if (email) data.email = email;
                if (phone) data.phone = phone;
                
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.status === "success") {
                    setStatus(`${name} registered successfully`, "success");
                    personName.value = '';
                    personEmail.value = '';
                    personPhone.value = '';
                    registerForm.style.display = 'none';
                    identifyFaces(); // Refresh results
                } else {
                    throw new Error(result.error || "Registration failed");
                }
            } catch (err) {
                setStatus("Error: " + err.message, "error");
                console.error("Registration error:", err);
            } finally {
                registerBtn.disabled = false;
            }
        }

        // Register unknown face
        async function registerUnknownFace(faceId) {
            const name = document.getElementById(`name-${faceId}`).value.trim();
            const email = document.getElementById(`email-${faceId}`).value.trim();
            const phone = document.getElementById(`phone-${faceId}`).value.trim();
            
            if (!name) {
                setStatus("Please enter a name", "error");
                return;
            }

            setStatus(`Registering ${name}...`, "info");
            
            try {
                const data = { 
                    name, 
                    face_id: faceId,
                    image: currentImage
                };
                
                if (email) data.email = email;
                if (phone) data.phone = phone;
                
                const response = await fetch('/api/register_unknown', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.status === "success") {
                    setStatus(`${name} registered successfully`, "success");
                    identifyFaces(); // Refresh results
                } else {
                    throw new Error(result.error || "Registration failed");
                }
            } catch (err) {
                setStatus("Error: " + err.message, "error");
                console.error("Registration error:", err);
            }
        }

        // Load events for dropdown
        async function loadEvents() {
            try {
                const response = await fetch('/api/events');
                const data = await response.json();
                
                if (data.status === "success" && data.events && data.events.length > 0) {
                    window._eventsMap = {};
                    eventSelect.innerHTML = data.events.map(event => {
                        window._eventsMap[event.name] = event;
                        return `<option value="${event.name}">${event.name}</option>`;
                    }).join('');
                } else {
                    eventSelect.innerHTML = '<option value="">No events available</option>';
                }
            } catch (err) {
                console.error("Error loading events:", err);
                eventSelect.innerHTML = '<option value="">Error loading events</option>';
            }
        }

        // Mark attendance for recognized faces
        async function markAttendance() {
            const eventName = eventSelect.value;
            const selectedEvent = window._eventsMap?.[eventName];
            if (selectedEvent) {
                attendanceStatus.innerHTML = `
                    <div class="info">
                        <strong>Faculty:</strong> ${selectedEvent.faculty || '-'}<br/>
                        <strong>Faculty ID:</strong> ${selectedEvent.facultyid || '-'}<br/>
                        <strong>Period:</strong> ${selectedEvent.period || '-'}
                    </div>
                `;
            }
            if (!eventName) {
                setStatus("Please select an event before marking attendance", "error");
                eventSelect.focus();
                return;
            }

            if (!currentResults?.known_faces || currentResults.known_faces.length === 0) {
                setStatus("No recognized faces to mark attendance", "error");
                return;
            }

            setStatus("Marking attendance...", "info");
            markAttendanceBtn.disabled = true;
            attendanceStatus.innerHTML = '';
            
            try {
                const promises = currentResults.known_faces.map(person => {
                    return fetch("/api/mark_attendance", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                            name: person.name, 
                            event: eventName 
                        })
                    }).then(res => res.json());
                });

                const results = await Promise.all(promises);
                const successCount = results.filter(r => r.status === "success").length;
                
                setStatus(`Attendance marked for ${successCount} people`, "success");
                attendanceStatus.innerHTML = `
                    <div class="success">
                        Successfully marked attendance for ${successCount} of ${currentResults.known_faces.length} people
                    </div>
                `;
            } catch (err) {
                setStatus("Error marking attendance", "error");
                console.error("Attendance error:", err);
            } finally {
                markAttendanceBtn.disabled = false;
            }
        }

        function displaySelectedEventInfo() {
            const eventName = eventSelect.value;
            const selectedEvent = window._eventsMap?.[eventName];

            if (selectedEvent) {
                document.getElementById('eventDetailsBox').innerHTML = `
                    <div class="info">
                        <strong>Title:</strong> ${selectedEvent.name || '-'}<br/>
                        <strong>Date:</strong> ${selectedEvent.date || '-'}<br/>
                        <strong>Time:</strong> ${selectedEvent.time || '-'}<br/>
                        <strong>Location:</strong> ${selectedEvent.location || '-'}<br/>
                        <strong>Faculty:</strong> ${selectedEvent.faculty || '-'}<br/>
                        <strong>Faculty ID:</strong> ${selectedEvent.facultyid || '-'}<br/>
                        <strong>Period:</strong> ${selectedEvent.period || '-'}
                    </div>
                `;
            } else {
                document.getElementById('eventDetailsBox').innerHTML = "";
            }
        }


        // Event listeners
        captureBtn.addEventListener('click', captureImage);
        identifyBtn.addEventListener('click', identifyFaces);
        registerBtn.addEventListener('click', registerPerson);
        markAttendanceBtn.addEventListener('click', markAttendance);

        document.getElementById('printEventBtn').addEventListener('click', () => {
        const content = document.getElementById('eventDetailsBox').innerHTML;
        const newWin = window.open('', '', 'width=600,height=600');
        newWin.document.write(`
                <html>
                <head><title>Print Event Details</title></head>
                <body>
                    <h2>Event Summary</h2>
                    <div>${content}</div>
                    <hr/>
                    <p style="font-size:12px;opacity:0.7;">Printed on ${new Date().toLocaleString()}</p>
                </body>
                </html>
            `);
            newWin.document.close();
            newWin.focus();
            newWin.print();
        });

        eventSelect.addEventListener('change', displaySelectedEventInfo);
        
        showRegisterBtn.addEventListener('click', () => {
            registerForm.style.display = 'block';
        });

        // Initialize app
        initCamera();
        loadEvents();
  }, []);

  return (
    <>
    <style>
        {`
        header {
            width: 100%;
            border-radius: 10px;
            background-color: #2c3e50;
            color: white;
            padding: 20px 0;
            margin-bottom: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #ffffff;
            text-align: center;
            margin-bottom: 30px;
        }
        .section {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        video, canvas, #photo {
            width: 100%;
            max-width: 500px;
            display: block;
            margin: 10px auto;
            border-radius: 4px;
        }
        button {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 10px 15px;
            margin: 5px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #2980b9;
        }
        button:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
        }
        input, select {
            padding: 8px;
            margin: 5px 0;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .success {
            background-color: #d4edda;
            color: #155724;
        }
        .error {
            background-color: #f8d7da;
            color: #721c24;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
        }
        .person-card {
            background: #f8f9fa;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        .unknown-face {
            background: #fff3cd;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
        }
        .face-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        .face-box {
            flex: 1;
            min-width: 300px;
        }
        #results {
            display: none;
        }
        #registerForm {
            display: none;
            margin-top: 20px;
        }
        #eventDetailsBox {
            border-left: 4px solid #3498db;
            background-color: #ecf7ff;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.05);
            font-size: 15px;
            line-height: 1.6;
        }
    `}
    </style>

    <header>
        <div style={{ display: 'flex', justifyContent: 'center' }} className="container">
          <h1>Event Registration</h1>
        </div>
      </header>

      <div className="section">
        <h2>📸 Live Camera</h2>
        <video id="video" autoPlay playsInline></video>
        <button id="captureBtn">Capture Photo</button>
        <canvas id="canvas" style={{ display: 'none' }}></canvas>
        <img id="photo" alt="Captured Image" style={{ display: 'none' }} />
    </div>

    <div className="section">
        <h2>⚡ Actions</h2>
        <button id="identifyBtn">Identify Faces</button>
        <button id="showRegisterBtn">Register New Person</button>
        
        <div id="registerForm">
            <h3>Register New Person</h3>
            <input type="text" id="personName" placeholder="Full Name" required/>
            <input type="email" id="personEmail" placeholder="Email (optional)"/>
            <input type="tel" id="personPhone" placeholder="Phone (optional)"/>
            <button id="registerBtn">Register</button>
        </div>
        
        <div id="status" className="status info">Ready to capture image</div>
    </div>

    <div id="results" className="section">
        <h2 style={{ display: 'none' }}>🔍 Recognition Results</h2>
        <div style={{ display: 'none' }} className="face-container">
            <div className="face-box">
                <h3>Original Image</h3>
                <img id="original-img"/>
            </div>
            <div className="face-box">
                <h3>Annotated Image</h3>
                <img id="annotated-img"/>
            </div>
        </div>
        
        <div id="known-faces">
            <h3>✅ Recognized Faces</h3>
            <div id="known-faces-list"></div>
        </div>
        
        <div id="unknown-faces">
            <h3>❓ Unknown Faces</h3>
            <div id="unknown-faces-list"></div>
        </div>
        
        <div id="after-detection">
            <h3>🎯 Mark Attendance</h3>
            <select id="event-select">
                <option value="">Select Event</option>
            </select>

            <div id="eventDetailsBox" class="status info" style={{ marginTop: "10px" }}></div>
            <button id="printEventBtn">🖨️ Print Event Details</button>

            <button id="markAttendanceBtn">Mark Attendance for Recognized Faces</button>
            <div id="attendanceStatus"></div>

        </div>
    </div>

    </>
  );
}

export default HomePage;
