import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Common/Button";
import { useAuthStore } from "../../store/auth.store";

export default function HiddenLogin() {
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authError = useAuthStore((s) => s.error);
  const setAuthError = useAuthStore((s) => s.setError);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    setError(null);
    setAuthError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username and password required! Refill and try again.");
      return;
    }

    await login(username, password);

    // Navigate only on success
    if (isAuthenticated || useAuthStore.getState().isAuthenticated) {
      navigate("/chats");
    }
  };

  const showError = error || authError;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0b141a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        position: "fixed",
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
      }}
    >
      <div
        style={{
          width: 320,
          padding: 24,
          backgroundColor: "#1f2c33",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <h2
          style={{
            color: "#e9edef",
            margin: 0,
            textAlign: "center",
          }}
        >
          {showError && (
            <div
              style={{
                backgroundColor: "#3b1d1d",
                color: "#ffb4b4",
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 10,
                border: "1px solid #5a2a2a",
              }}
            >
              {showError}
            </div>
          )}
          Login
        </h2>

        <input
          placeholder="Username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
            setAuthError(null);
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "none",
            outline: "none",
            boxSizing: "border-box",
            backgroundColor: "#2a3942",
            color: "#e9edef",
            fontSize: 14,
          }}
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
            setAuthError(null);
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            border: "none",
            outline: "none",
            boxSizing: "border-box",
            backgroundColor: "#2a3942",
            color: "#e9edef",
            fontSize: 14,
          }}
        />

        <Button
          style={{ width: "100%", height: 40 }}
          onClick={handleLogin}
          disabled={isLoading || !username || !password}
        >
          Continue
        </Button>

        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontSize: 13,
            color: "#c0c0c0",
          }}
        >
          New here?{" "}
          <span
            style={{ color: "#1e90ff", cursor: "pointer" }}
            onClick={() => navigate("/Signup")}
          >
            Sign Up
          </span>
        </div>
      </div>
    </div>
  );
}
