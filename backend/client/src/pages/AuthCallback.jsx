// src/pages/AuthCallback.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    try {
      // token is placed in URL fragment: /auth/callback#token=...&provider=...
      const hash = window.location.hash || "";
      const params = new URLSearchParams(hash.replace(/^#/, ""));
      const token = params.get("token");

      if (!token) {
        // nothing to do — redirect to login
        navigate("/login");
        return;
      }

      // store token in localStorage (as you requested earlier)
      localStorage.setItem("jwt_token", token);

      // optionally store provider for UI, e.g. localStorage.setItem("auth_provider", provider);
      // then remove fragment to clean URL
      window.history.replaceState({}, document.title, "/");

      // navigate to dashboard
      navigate("/dashboard");
    } catch (err) {
      console.error("Auth callback error:", err);
      navigate("/login");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-lg text-slate-600">Signing you in…</p>
      </div>
    </div>
  );
}
