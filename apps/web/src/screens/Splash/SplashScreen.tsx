import { useNavigate } from "react-router-dom";
import Button from "../../components/Common/Button";
import { useAuthStore } from "../../store/auth.store";
import LogoIcon from "./icon.webp"; // Adjust the path if needed


export default function SplashScreen() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
const handleHiddenEntry = () => {
  if (isAuthenticated) {
    navigate("/chats");
  } else {
    navigate("/login");
  }
};


  return (
    <div
      style={{
  width: "100vw",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#f2f9fe",
  position: "fixed",
  top: 0,
  left: 0,
  overflow: "hidden", // Prevents scrolling inside this div too
}}
    >
      {/* LOGO PLACEHOLDER */}
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: 16,
          backgroundColor: "#1f2c33",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 32,
          color: "#8696a0",
          fontSize: 14,
        }}
      >
        <img
          src={LogoIcon}
          alt="Logo"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover", // cover the div
          }}
        />
      </div>

      {/* CENTER FAKE BUTTON */}
      <Button
        onClick={() => navigate("/fake")}
        style={{
          padding: "14px 32px",
          fontSize: 16,
        }}
      >
        Login
      </Button>

      {/* HIDDEN / REAL LOGIN BUTTON (BOTTOM RIGHT) */}
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
        }}
      >
        <Button
          variant="ghost"
        onClick={handleHiddenEntry}
          style={{ fontSize: 12,
            color: "#ea1313",
            width: 40,
          height: 40,
            backgroundColor: "#f2f9fe",
           }}
        >
        
        </Button>
      </div>
    </div>
  );
}
