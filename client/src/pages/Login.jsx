// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { SiMicrosoft } from "react-icons/si";
import iitgimg from "../assets/iitg2.jpeg";
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'azure' | 'google' | null
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Use env var for backend base. If empty, fallback to origin.
  const BACKEND_BASE =
    process.env.REACT_APP_BACKEND_URL || window.location.origin;

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("jwt_token");
      if (!token) {
        setCheckingAuth(false);
        return;
      }

      try {
        const res = await api.get("/users/me");
        const user = res.data.user;
        
        // Redirect based on role
        if (user.role === "admin") {
          navigate("/admin", { replace: true });
        } else if (user.role === "poc") {
          navigate("/poc", { replace: true });
        } else if (user.role === "student") {
          navigate("/student", { replace: true });
        } else if (user.role === "viewer") {
          navigate("/viewers/confirmed", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        // Token invalid or expired, clear it
        localStorage.removeItem("jwt_token");
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const submitLocal = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { emailId: email, password });
      const { token } = res.data;
      if (!token) throw new Error("No token returned");
      localStorage.setItem("jwt_token", token);
      
      // Get user info to redirect to appropriate dashboard
      const userRes = await api.get("/users/me");
      const user = userRes.data.user;
      
      if (user.role === "admin") {
        navigate("/admin");
      } else if (user.role === "poc") {
        navigate("/poc");
      } else if (user.role === "student") {
        navigate("/student");
      } else if (user.role === "viewer") {
        navigate("/viewers/confirmed");
      } else {
        navigate("/dashboard");
      }
    } catch (e) {
      setErr(e.response?.data?.message || e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = (provider) => {
    // show a small loading state
    setOauthLoading(provider);

    // Build the full backend login URL and navigate the browser to it.
    // Backend will redirect to provider (Microsoft/Google).
    const loginUrl = `${BACKEND_BASE}/dday/api/auth/oauth/${provider}/login`;

    // Navigate in same tab so provider can redirect back to backend callback.
    window.location.href = loginUrl;
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-slate-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${iitgimg})` }}
    >
      {/* Semi-transparent overlay matching portal #EEF1F4 */}
      <div className="absolute inset-0" style={{ background: "rgba(238,241,244,0.55)" }} />

      <div
        className="relative z-10 w-full max-w-md bg-white p-8"
        style={{
          borderRadius: "4px",
          boxShadow: "0px 0.3px 0.9px rgba(27,33,45,0.10), 0px 1.6px 3.6px rgba(27,33,45,0.13)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: "1px solid #E9E9EB" }}>
          <img
            src="https://www.iitg.ac.in/gate-jam/img/logo.png"
            alt="IITG"
            className="h-14 w-14 object-contain flex-shrink-0"
          />
          <div>
            <div className="font-bold text-base" style={{ color: "#1E2532" }}>
              DDay Portal
            </div>
            
          </div>
        </div>

        <h2 className="text-lg font-bold mb-1" style={{ color: "#1E2532" }}>
          Sign in to your account
        </h2>
        <p className="text-sm mb-6" style={{ color: "#8D9096" }}>
          Use your institute credentials or email &amp; password
        </p>

        {/* OAuth buttons */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => oauthLogin("azure")}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-3 px-4 disabled:opacity-50 transition"
            style={{
              height: "36px",
              border: "1px solid #767A81",
              borderRadius: "2px",
              background: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              color: "#353B47",
            }}
          >
            {oauthLoading === "azure" ? (
              <span>Redirecting to Microsoft…</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23" className="w-4 h-4 flex-shrink-0">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="13" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="13" width="9" height="9" fill="#00a4ef" />
                  <rect x="13" y="13" width="9" height="9" fill="#ffb900" />
                </svg>
                <span>Sign in with Microsoft</span>
              </>
            )}
          </button>

          <button
            onClick={() => oauthLogin("google")}
            disabled={!!oauthLoading}
            className="w-full flex items-center justify-center gap-3 px-4 disabled:opacity-50 transition"
            style={{
              height: "36px",
              border: "1px solid #767A81",
              borderRadius: "2px",
              background: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              color: "#353B47",
            }}
          >
            {oauthLoading === "google" ? (
              <span>Redirecting to Google…</span>
            ) : (
              <>
                <FcGoogle className="w-4 h-4 flex-shrink-0" />
                <span>Sign in with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px" style={{ background: "#E9E9EB" }} />
          <span className="text-xs font-semibold" style={{ color: "#8D9096" }}>OR</span>
          <div className="flex-1 h-px" style={{ background: "#E9E9EB" }} />
        </div>

        {/* Local login form */}
        <form onSubmit={submitLocal} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#353B47" }}>
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="you@iitg.ac.in"
              style={{
                width: "100%", height: "32px",
                padding: "0 10px",
                border: "0.5px solid #767A81",
                borderRadius: "4px",
                fontSize: "14px",
                color: "#353B47",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#2164E8")}
              onBlur={e => (e.target.style.borderColor = "#767A81")}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: "#353B47" }}>
              Password
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              style={{
                width: "100%", height: "32px",
                padding: "0 10px",
                border: "0.5px solid #767A81",
                borderRadius: "4px",
                fontSize: "14px",
                color: "#353B47",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.target.style.borderColor = "#2164E8")}
              onBlur={e => (e.target.style.borderColor = "#767A81")}
            />
          </div>

          {err && (
            <div className="text-sm" style={{ color: "#D83B01" }}>{err}</div>
          )}

          <button
            type="submit"
            disabled={loading || !!oauthLoading}
            className="w-full pp-btn disabled:opacity-50"
            style={{ height: "36px", fontSize: "14px" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-xs text-center" style={{ color: "#8D9096" }}>
          Having trouble?{" "}
          <a href="mailto:ccd.techsupport@iitg.ac.in" style={{ color: "#2164E8" }}>
            ccd.techsupport@iitg.ac.in
          </a>
        </p>
      </div>
    </div>
  );
}

