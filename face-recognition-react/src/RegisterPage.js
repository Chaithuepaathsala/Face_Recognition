import React, { useRef, useState, useEffect } from "react";
import {
  Button,
  TextField,
  Container,
  Typography,
  Grid,
  Box,
  MenuItem,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Avatar,
  Stack,
  Fade,
  Zoom,
  Slide,
  Grow,
  Alert,
  Snackbar,
  IconButton
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { CameraAlt, PersonAdd, Face, ErrorOutline, ArrowBack } from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";

// Animation keyframes
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// Styled components
const StyledVideo = styled('video')(({ theme }) => ({
  width: "100%",
  maxWidth: "400px",
  height: "auto",
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[4],
  margin: theme.spacing(2, 0),
  transform: 'translateZ(0)',
  animation: `${fadeIn} 0.5s ease-in`,
}));

const PreviewImage = styled('img')(({ theme }) => ({
  width: "100%",
  maxWidth: "400px",
  height: "auto",
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  border: `1px solid ${theme.palette.divider}`,
  animation: `${fadeIn} 0.5s ease-in`,
}));

const ActionButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  fontWeight: 600,
  minWidth: 120,
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const PulseAvatar = styled(Avatar)(({ theme }) => ({
  animation: `${pulse} 2s infinite`,
  width: 72,
  height: 72,
  marginBottom: theme.spacing(3),
}));

const FormTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius,
    transition: 'all 0.3s ease',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "",
    regno: "",
    programcode: "",
    admissionyear: "",
    semester: "",
    section: "",
    department: "",
    category: "",
    address: "",
    quota: "",
    status: "",
    status1:"",
    colid:"",
    gender: "",
    photo: "",
  });

  const [preview, setPreview] = useState(null);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const navigate = useNavigate();

  // Environment variables
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
  const REGISTER_ENDPOINT = process.env.REACT_APP_REGISTER_ENDPOINT || "/register_user";
  const API_URL = `${API_BASE_URL}${REGISTER_ENDPOINT}`;

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      setCameraStarted(false);
      
      // First check if we already have a stream and clean it up
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MediaDevices API not supported in this browser");
      }

      // Try to get camera permissions status
      let permissionStatus;
      try {
        permissionStatus = await navigator.permissions.query({ name: 'camera' });
        if (permissionStatus.state === 'denied') {
          throw new Error("Camera permission permanently denied. Please enable in browser settings.");
        }
      } catch (permError) {
        console.log("Permission API not available, continuing...");
      }

      const constraints = {
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      };
      
      // Add timeout for camera access
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Camera access timed out")), 5000);
      });

      const mediaStream = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        timeoutPromise
      ]);

      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      setCameraStarted(true);
      
      // Handle cases where the stream ends unexpectedly
      mediaStream.getVideoTracks()[0].onended = () => {
        setCameraError("Camera stream ended unexpectedly");
        setCameraStarted(false);
      };
      
    } catch (err) {
      let errorMessage = "Could not access camera. Please check permissions and try again.";
      
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = "No camera device found.";
      } else if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera is already in use by another application.";
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = "Requested camera configuration not available.";
      } else if (err.message === "Camera access timed out") {
        errorMessage = "Camera access took too long. Please try again.";
      }
      
      setCameraError(errorMessage);
      console.error("Camera error:", err);
      setCameraStarted(false);
    }
  };

  const captureImage = () => {
    try {
      if (!videoRef.current || !stream) {
        throw new Error("Camera not initialized");
      }

      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Video stream not ready");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");
      setPreview(imageData);
      setFormData(prev => ({ ...prev, image: imageData }));

      // Stop the camera stream
      stream.getTracks().forEach(track => track.stop());
      setCameraStarted(false);
    } catch (err) {
      setCameraError("Failed to capture image: " + err.message);
      console.error("Capture error:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.image) {
      setError("Please capture an image first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Network response was not ok");
      }

      const data = await response.json();
      
      if (data.message === "User registered successfully") {
        setTimeout(() => {
          navigate("/");
        }, 1000);
      } else {
        setError(data.message || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Error submitting form. Please try again.");
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseError = () => {
    setError(null);
    setCameraError(null);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        p: 2,
      }}
    >
      <Fade in={true} timeout={500}>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Zoom in={true} timeout={600}>
            <Paper 
              elevation={6} 
              sx={{ 
                p: { xs: 3, sm: 4 },
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
              }}
            >
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  position: 'absolute',
                  left: 16,
                  top: 16,
                  color: 'primary.main',
                }}
              >
                <ArrowBack />
              </IconButton>

              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                textAlign="center"
              >
                <PulseAvatar sx={{ bgcolor: 'primary.main' }}>
                  <PersonAdd fontSize="large" />
                </PulseAvatar>
                
                <Slide direction="down" in={true} timeout={700}>
                  <Typography 
                    variant="h3" 
                    component="h1" 
                    gutterBottom 
                    sx={{ 
                      fontWeight: 700,
                      background: 'linear-gradient(45deg, #1976d2 30%, #21CBF3 90%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      mb: 2
                    }}
                  >
                    User Registration
                  </Typography>
                </Slide>
                
                <Grow in={true} timeout={800}>
                  <Typography 
                    variant="subtitle1" 
                    color="text.secondary" 
                    paragraph
                    sx={{ maxWidth: '80%', mb: 3 }}
                  >
                    Complete the form and capture your face for secure registration
                  </Typography>
                </Grow>

                {/* Camera Section */}
                <Card 
                  variant="outlined" 
                  sx={{ 
                    width: '100%', 
                    mt: 2,
                    mb: 4,
                    border: 'none',
                    background: 'transparent',
                    boxShadow: '0 8px 32px rgba(31, 38, 135, 0.1)'
                  }}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{ position: 'relative', width: '100%', maxWidth: '400px', height: '300px', mb: 2 }}>
                      <StyledVideo
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: cameraStarted ? 'block' : 'none' }}
                      />
                      
                      {!cameraStarted && !preview && (
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(0, 0, 0, 0.05)',
                            borderRadius: 2,
                            zIndex: 1,
                            gap: 2
                          }}
                        >
                          <CameraAlt sx={{ fontSize: 48, color: 'text.secondary' }} />
                          <Typography color="text.secondary" textAlign="center">
                            {cameraError ? cameraError : "Camera is off. Click 'Start Camera' to begin"}
                          </Typography>
                          {cameraError && (
                            <Button variant="outlined" onClick={startCamera}>Retry Camera</Button>
                          )}
                        </Box>
                      )}
                    </Box>
          
                    {preview && (
                      <Box mt={3} textAlign="center">
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 500 }}>
                          CAPTURED PHOTO
                        </Typography>
                        <PreviewImage
                          src={preview}
                          alt="Preview"
                        />
                        <Button 
                          variant="outlined" 
                          onClick={() => {
                            setPreview(null);
                            setFormData(prev => ({ ...prev, image: "" }));
                          }}
                          sx={{ mt: 2 }}
                        >
                          Retake Photo
                        </Button>
                      </Box>
                    )}

                    <Stack 
                      direction={{ xs: 'column', sm: 'row' }} 
                      spacing={2} 
                      sx={{ mt: 3, width: '100%', justifyContent: 'center' }}
                    >
                      <ActionButton
                        variant="contained"
                        startIcon={<CameraAlt />}
                        onClick={startCamera}
                        disabled={loading || cameraStarted || !!preview}
                        sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                      >
                        Start Camera
                      </ActionButton>
                      
                      <ActionButton
                        variant="contained"
                        color="secondary"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                        onClick={captureImage}
                        disabled={!cameraStarted || loading}
                        sx={{ 
                          minWidth: { xs: '100%', sm: 'auto' },
                          animation: loading ? `${pulse} 1.5s infinite` : 'none'
                        }}
                      >
                        {loading ? 'Processing...' : 'Capture Image'}
                      </ActionButton>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Registration Form */}
                <Box component="form" width="100%">
                  <Grid container spacing={3}>
                    {[
                      { name: 'name', label: 'Full Name', xs: 12, sm: 6 },
                      { name: 'email', label: 'Email', xs: 12, sm: 6 },
                      { name: 'password', label: 'Password', type: 'password', xs: 12, sm: 6 },
                      { name: 'phone', label: 'Phone Number', xs: 12, sm: 6 },
                      { name: 'role', label: 'Role', xs: 12, sm: 6 },
                      { name: 'regno', label: 'Registration Number', xs: 12, sm: 6 },
                      { name: 'programcode', label: 'Program Code', xs: 12, sm: 6 },
                      { name: 'admissionyear', label: 'Admission Year', xs: 12, sm: 6 },
                      { name: 'semester', label: 'Semester', xs: 12, sm: 6 },
                      { name: 'section', label: 'Section', xs: 12, sm: 6 },
                      { name: 'department', label: 'Department', xs: 12, sm: 6 },
                      { name: 'category', label: 'Category', xs: 12, sm: 6 },
                      { name: 'address', label: 'Address', xs: 12 },
                      { name: 'quota', label: 'Quota', xs: 12, sm: 6 },
                      { name: 'status', label: 'Status', xs: 12, sm: 6 },
                      { name: 'status1', label: 'Status1', xs: 12, sm: 6 },
                      { name: 'colid', label: 'Colid', xs: 12, sm: 6 },
                    ].map((field, index) => (
                      <Grid item xs={field.xs} sm={field.sm || 12} key={field.name}>
                        <Grow in={true} timeout={800 + (index * 50)}>
                          <FormTextField
                            label={field.label}
                            name={field.name}
                            type={field.type || 'text'}
                            fullWidth
                            value={formData[field.name] || ''}
                            onChange={handleChange}
                            variant="outlined"
                          />
                        </Grow>
                      </Grid>
                    ))}

                    <Grid item xs={12}>
                      <Grow in={true} timeout={1000}>
                        <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                          <FormTextField
                            select
                            label="Gender"
                            name="gender"
                            value={formData.gender || ''}
                            onChange={handleChange}
                            variant="outlined"
                            sx={{ width: { xs: '100%', sm: '300px' } }}
                          >
                            <MenuItem value="">Select Gender</MenuItem>
                            <MenuItem value="Male">Male</MenuItem>
                            <MenuItem value="Female">Female</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                          </FormTextField>
                        </Box>
                      </Grow>
                    </Grid>
                  </Grid>

                  <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                    <Grow in={true} timeout={1200}>
                      <ActionButton
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={handleSubmit}
                        disabled={loading || !formData.image}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                        sx={{ 
                          minWidth: 200,
                          animation: loading ? `${pulse} 1.5s infinite` : 'none'
                        }}
                      >
                        {loading ? 'Registering...' : 'Complete Registration'}
                      </ActionButton>
                    </Grow>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Zoom>
        </Container>
      </Fade>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error || !!cameraError}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="error" 
          variant="filled"
          icon={<ErrorOutline />}
          onClose={handleCloseError}
          sx={{ width: '100%' }}
        >
          {error || cameraError}
        </Alert>
      </Snackbar>
    </Box>
  );
}