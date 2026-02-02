import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.store";
import SplashScreen from "../screens/Splash/SplashScreen";
import HiddenLogin from "../screens/HiddenLogin/HiddenLogin";
import ChatList from "../screens/ChatList/ChatList";
import ChatWindow from "../screens/ChatWindow/ChatWindow";
import Signup from "../screens/Signup/signup";

// Fake / placeholder screen (always black)
const FakeScreen = () => (
  <div style={{ width: "100vw", height: "100vh", background: "black" }} />
);

export default function AppRoutes() {
  const { isAuthenticated } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        {/* Splash always waits for user action */}
        <Route path="/" element={<SplashScreen />} />

        {/* Fake screen: ALWAYS false, no auth logic */}
        <Route path="/fake" element={<FakeScreen />} />

        {/* Signup */}
        <Route path="/Signup" element={<Signup />} />

        {/* Hidden login */}
        <Route path="/login" element={<HiddenLogin />} />

        {/* Desktop chats shell */}
        <Route
          path="/chats"
          element={
            isAuthenticated ? <ChatList /> : <Navigate to="/" replace />
          }
        />

        {/* Mobile / full screen chat */}
        <Route
          path="/chat/:id"
          element={
            isAuthenticated ? <ChatWindow /> : <Navigate to="/" replace />
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
