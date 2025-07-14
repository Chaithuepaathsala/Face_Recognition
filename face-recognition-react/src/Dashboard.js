import React from "react";
import { useNavigate } from "react-router-dom";
import GlobalStore from "./global1";
import {
  Button,
  Container,
  Typography,
  Box,
  Paper,
  Avatar,
  Stack,
  Fade,
  Zoom,
  Slide,
  Grow,
  styled,
  keyframes,
  Divider,
} from "@mui/material";
import { Event, School, HowToReg } from "@mui/icons-material";
import { red } from "@mui/material/colors";

// Animation keyframes
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const gradientBG = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Styled components
const AnimatedPaper = styled(Paper)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius * 2,
  padding: theme.spacing(4),
  background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, #f5f7fa 100%)`,
  boxShadow: theme.shadows[10],
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "translateY(-5px)",
    boxShadow: theme.shadows[16],
  },
}));

const DashboardButton = styled(Button)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius * 2,
  fontWeight: 600,
  minWidth: 200,
  height: 120,
  transition: "all 0.3s ease",
  "&:hover": {
    transform: "translateY(-5px)",
    boxShadow: theme.shadows[8],
  },
}));

const FloatingAvatar = styled(Avatar)(({ theme }) => ({
  width: 80,
  height: 80,
  marginBottom: theme.spacing(2),
  animation: `${float} 4s ease-in-out infinite`,
  boxShadow: theme.shadows[6],
}));

export default function DashboardPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Event fontSize="large" />,
      title: "Event System",
      action: () => navigate("/event"),
      color: "primary",
    },
    {
      icon: <School fontSize="large" />,
      title: "Admission Form",
      action: () => navigate("/admission"),
      color: "secondary",
    },
    {
      icon: <HowToReg fontSize="large" />,
      title: "Attendance System",
      action: () => navigate("/attendance"),
      color: "success",
    },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Box
        sx={{
          width: "240px",
          backgroundColor: "#1e1e2f",
          color: "white",
          p: 3,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <Box>
          {/* User Profile */}
          <Box display="flex" alignItems="center" flexDirection="column" mb={2}>
            <Avatar
              src={GlobalStore.user?.photo}
              alt={GlobalStore.user?.name}
              sx={{ width: 64, height: 64, mb: 1 }}
            />
            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
              {GlobalStore.user?.name || "Guest"}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {GlobalStore.user?.email || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {GlobalStore.user?.phone || ""}
            </Typography>
          </Box>

          <Divider sx={{ mb: 2, borderColor: "rgba(255,255,255,0.2)" }} />

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5, // vertical spacing between each item
            }}
          >
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Address: {GlobalStore.user?.address || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Department: {GlobalStore.user?.department || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Role: {GlobalStore.user?.role || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Program Code: {GlobalStore.user?.programcode || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Admission Year: {GlobalStore.user?.admissionyear || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Semester: {GlobalStore.user?.semester || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Section: {GlobalStore.user?.section || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Gender: {GlobalStore.user?.gender || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Category: {GlobalStore.user?.category || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Quota: {GlobalStore.user?.quota || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Status1: {GlobalStore.user?.status1 || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Col ID: {GlobalStore.user?.colid || ""}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Status: {GlobalStore.user?.status || ""}
            </Typography>
          </Box>
          {/* Navigation Items */}
          <Button
            onClick={() => {
              GlobalStore.user = null;
              navigate("/login");
            }}
            variant="outlined"
            fullWidth
            sx={{
              mb: 1,
              mt: 2,
              color: "white",
              borderColor: "rgba(255,255,255,0.3)",
              "&:hover": {
                borderColor: "white",
              },
            }}
          >
            Log Out
          </Button>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            &copy; 2025 Campus Technology
          </Typography>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          background:
            "linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)",
          backgroundSize: "400% 400%",
          animation: `${gradientBG} 15s ease infinite`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 8,
          px: 2,
        }}
      >
        <Fade in={true} timeout={1000}>
          <Container maxWidth="md">
            <Zoom in={true} timeout={800}>
              <AnimatedPaper elevation={3}>
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  textAlign="center"
                >
                  <Slide direction="down" in={true} timeout={500}>
                    <FloatingAvatar sx={{ bgcolor: "primary.main" }}>
                      <School fontSize="large" />
                    </FloatingAvatar>
                  </Slide>

                  <Grow in={true} timeout={800}>
                    <Typography
                      variant="h3"
                      component="h1"
                      gutterBottom
                      sx={{
                        fontWeight: 700,
                        mb: 4,
                        background:
                          "linear-gradient(45deg, #1976d2 30%, #21CBF3 90%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Campus Technology
                    </Typography>
                  </Grow>

                  <Grow in={true} timeout={1000}>
                    <Typography
                      variant="subtitle1"
                      color="text.secondary"
                      paragraph
                      sx={{
                        maxWidth: "80%",
                        mb: 6,
                        fontSize: "1.1rem",
                      }}
                    >
                      Manage all campus activities efficiently with our
                      integrated solutions
                    </Typography>
                  </Grow>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={4}
                    sx={{
                      width: "100%",
                      justifyContent: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {features.map((feature, index) => (
                      <Grow
                        in={true}
                        timeout={1200 + index * 200}
                        key={feature.title}
                      >
                        <DashboardButton
                          variant="contained"
                          color={feature.color}
                          startIcon={
                            <Avatar sx={{ bgcolor: "white", mr: 1 }}>
                              {React.cloneElement(feature.icon, {
                                color: feature.color,
                                fontSize: "medium",
                              })}
                            </Avatar>
                          }
                          onClick={feature.action}
                          sx={{
                            flexDirection: "column",
                            justifyContent: "center",
                            "& .MuiButton-startIcon": {
                              margin: 0,
                              mb: 1,
                            },
                          }}
                        >
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {feature.title}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.8 }}>
                            Click to access
                          </Typography>
                        </DashboardButton>
                      </Grow>
                    ))}
                  </Stack>
                </Box>
              </AnimatedPaper>
            </Zoom>
          </Container>
        </Fade>
      </Box>
    </Box>
  );
}
