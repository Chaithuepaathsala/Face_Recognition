import React, { useRef, useState, useEffect } from "react";
import GlobalStore from "./global1";
import {
  Button,
  Container,
  Typography,
  Box,
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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  CameraAlt,
  Login,
  PersonAdd,
  Face,
  ErrorOutline,
} from "@mui/icons-material";
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
const StyledVideo = styled("video")(({ theme }) => ({
  width: "100%",
  maxWidth: "400px",
  height: "300px", // Fixed height for consistent aspect ratio
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[4],
  margin: theme.spacing(2, 0),
  backgroundColor: "#000",
  transform: "translateZ(0)",
  animation: `${fadeIn} 0.5s ease-in`,
}));

const PreviewImage = styled("img")(({ theme }) => ({
  width: "100%",
  maxWidth: "400px",
  height: "300px",
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  border: `1px solid ${theme.palette.divider}`,
  animation: `${fadeIn} 0.5s ease-in`,
  objectFit: "cover",
}));

const ActionButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  fontWeight: 600,
  minWidth: 120,
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[4],
  },
}));

const PulseAvatar = styled(Avatar)(({ theme }) => ({
  animation: `${pulse} 2s infinite`,
  width: 72,
  height: 72,
  marginBottom: theme.spacing(3),
}));

export default function LoginPage() {
  const videoRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [devices, setDevices] = useState([]);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const navigate = useNavigate();

  // Environment variables
  const API_BASE_URL =
    process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
  const LOGIN_ENDPOINT = process.env.REACT_APP_LOGIN_ENDPOINT || "/login_face";
  const API_URL = `${API_BASE_URL}${LOGIN_ENDPOINT}`;

  // Check camera permissions and available devices
  useEffect(() => {
    const checkPermissionsAndDevices = async () => {
      try {
        // Check if browser supports mediaDevices API
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.enumerateDevices
        ) {
          setError("Camera API not supported in this browser");
          return;
        }

        // First try to enumerate devices without permissions
        const initialDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = initialDevices.filter(
          (device) => device.kind === "videoinput"
        );
        setDevices(videoDevices);

        // If we have device labels, we already have permission
        if (videoDevices.some((device) => device.label)) {
          setHasCameraPermission(true);
          return;
        }

        // Try to get a media stream to trigger permission prompt
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        stream.getTracks().forEach((track) => track.stop());

        // Now enumerate devices again with permission
        const permittedDevices =
          await navigator.mediaDevices.enumerateDevices();
        setDevices(
          permittedDevices.filter((device) => device.kind === "videoinput")
        );
        setHasCameraPermission(true);
      } catch (err) {
        console.log("Permission check error:", err);
        setHasCameraPermission(false);
        if (err.name === "NotAllowedError") {
          setError(
            "Camera access denied. Please enable camera permissions in your browser settings."
          );
        } else {
          setError("Could not access camera devices.");
        }
      }
    };

    checkPermissionsAndDevices();
  }, []);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);

      // Verify video element exists
      if (!videoRef.current) {
        throw new Error("Video element not initialized");
      }

      // Check if we have permission and devices
      if (hasCameraPermission === false) {
        throw new Error("Camera access denied. Please enable permissions.");
      }

      if (devices.length === 0) {
        throw new Error("No camera devices available");
      }

      const constraints = {
        video: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          facingMode: "user",
          deviceId:
            devices.length > 1 ? { exact: devices[0].deviceId } : undefined,
        },
      };

      const stream = await navigator.mediaDevices
        .getUserMedia(constraints)
        .catch((err) => {
          if (err.name === "NotAllowedError") {
            throw new Error(
              "Camera access denied. Please allow camera permissions."
            );
          } else if (err.name === "NotFoundError") {
            throw new Error("No camera device found.");
          } else if (err.name === "NotReadableError") {
            throw new Error("Camera is already in use by another application.");
          } else {
            throw new Error("Could not access camera: " + err.message);
          }
        });

      // Double check video element exists
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Video element reference lost");
      }

      // Stop any existing stream
      if (videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }

      // Connect stream to video element
      videoRef.current.srcObject = stream;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            .play()
            .then(resolve)
            .catch((err) => {
              reject(new Error("Failed to play video stream: " + err.message));
            });
        };

        videoRef.current.onerror = () => {
          reject(new Error("Failed to load video stream"));
        };

        // Timeout fallback
        setTimeout(() => {
          reject(new Error("Camera stream timed out"));
        }, 5000);
      });

      setCameraStarted(true);
    } catch (err) {
      setError(err.message);
      setCameraStarted(false);
      console.error("Camera error:", err);

      // Clean up if needed
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  };

  const captureImage = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!videoRef.current || !videoRef.current.videoWidth) {
        throw new Error("Camera not ready. Please start camera first.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL("image/jpeg");
      setPreview(imageData);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });

      if (response.status === 404) {
        throw new Error("Face not recognized. Please try again.");
      }

      if (!response.ok) {
        throw new Error("Server error. Please try again.");
      }

      const data = await response.json();

      if (data.name) {
        GlobalStore.user = data;
        console.log("User stored in GlobalStore:", GlobalStore.user);
        setTimeout(() => {
          navigate("/dashboard");
        }, 500);
      } else {
        throw new Error("Face not recognized. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseError = () => {
    setError(null);
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        p: 2,
      }}
    >
      <Fade in={true} timeout={500}>
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Zoom in={true} timeout={600}>
            <Paper
              elevation={6}
              sx={{
                p: { xs: 3, sm: 4 },
                borderRadius: 4,
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                textAlign="center"
              >
                <PulseAvatar sx={{ bgcolor: "primary.main" }}>
                  <Face fontSize="large" />
                </PulseAvatar>

                <Slide direction="down" in={true} timeout={700}>
                  <Typography
                    variant="h3"
                    component="h1"
                    gutterBottom
                    sx={{
                      fontWeight: 700,
                      background:
                        "linear-gradient(45deg, #1976d2 30%, #21CBF3 90%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      mb: 2,
                    }}
                  >
                    Face ID Login
                  </Typography>
                </Slide>

                <Grow in={true} timeout={800}>
                  <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    paragraph
                    sx={{ maxWidth: "80%", mb: 3 }}
                  >
                    Position your face in the frame and click Login to
                    authenticate securely
                  </Typography>
                </Grow>

                {/* Camera View */}
                <Card
                  variant="outlined"
                  sx={{
                    width: "100%",
                    mt: 2,
                    border: "none",
                    background: "transparent",
                    boxShadow: "0 8px 32px rgba(31, 38, 135, 0.1)",
                  }}
                >
                  <CardContent
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "400px",
                        height: "300px",
                        mb: 2,
                      }}
                    >
                      <StyledVideo
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ display: cameraStarted ? "block" : "none" }}
                        onError={(e) => {
                          setError("Video stream error");
                          setCameraStarted(false);
                          console.error("Video element error:", e);
                        }}
                      />
                      {!cameraStarted && (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(0, 0, 0, 0.05)",
                            borderRadius: 2,
                            zIndex: 1,
                          }}
                        >
                          <Typography color="text.secondary">
                            {hasCameraPermission === false
                              ? "Camera access denied. Please enable permissions."
                              : devices.length === 0
                              ? "No camera detected"
                              : 'Click "Start Camera" to begin'}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {preview && (
                      <Box mt={3} textAlign="center">
                        <Typography
                          variant="subtitle1"
                          gutterBottom
                          sx={{ fontWeight: 500 }}
                        >
                          CAPTURED IMAGE
                        </Typography>
                        <PreviewImage src={preview} alt="Preview" />
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Buttons */}
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ mt: 4, width: "100%", justifyContent: "center" }}
                >
                  <ActionButton
                    variant="contained"
                    startIcon={<CameraAlt />}
                    onClick={startCamera}
                    disabled={
                      loading ||
                      cameraStarted ||
                      hasCameraPermission === false ||
                      devices.length === 0
                    }
                    sx={{ minWidth: { xs: "100%", sm: "auto" } }}
                  >
                    Start Camera
                  </ActionButton>

                  <ActionButton
                    variant="contained"
                    color="primary"
                    startIcon={
                      loading ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <Login />
                      )
                    }
                    onClick={captureImage}
                    disabled={!cameraStarted || loading}
                    sx={{
                      minWidth: { xs: "100%", sm: "auto" },
                      animation: loading ? `${pulse} 1.5s infinite` : "none",
                    }}
                  >
                    {loading ? "Authenticating..." : "Login"}
                  </ActionButton>

                  <ActionButton
                    variant="outlined"
                    startIcon={<PersonAdd />}
                    onClick={() => navigate("/register")}
                    disabled={loading}
                    sx={{ minWidth: { xs: "100%", sm: "auto" } }}
                  >
                    Register
                  </ActionButton>
                </Stack>
              </Box>
            </Paper>
          </Zoom>
        </Container>
      </Fade>

      {/* Error Snackbar */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity="error"
          variant="filled"
          icon={<ErrorOutline />}
          onClose={handleCloseError}
          sx={{ width: "100%" }}
        >
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
