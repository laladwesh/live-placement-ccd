import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    localStorage.setItem("jwt_token", token);

    (async () => {
      try {
        const res = await api.get("/users/me");
        const user = res.data.user;
        
        window.history.replaceState(null, "", window.location.pathname);
        
        // Redirect based on user role
        if (user.role === "admin") {
          navigate("/admin", { replace: true });
        } else if (user.role === "poc") {
          navigate("/poc", { replace: true });
        } else if (user.role === "student") {
          navigate("/student", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        console.error("whoami failed", err);
        localStorage.removeItem("jwt_token");
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="text-slate-700">Signing you in…</div>
      </div>
    </div>
  );
}
