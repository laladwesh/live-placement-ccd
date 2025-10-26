// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { SiMicrosoft } from "react-icons/si";

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
    const loginUrl = `${BACKEND_BASE}/api/auth/oauth/${provider}/login`;

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
  style={{
    backgroundImage: "url('/iitg2.jpeg')",
  }}
    >
      {/* Light overlay */}
  <div className="absolute inset-0 bg-white/80"></div>
      <div className="max-w-md w-full bg-white backdrop-blur-lg rounded-2xl shadow-lg p-8">
        <h2 className="text-2xl font-semibold text-slate-800 mb-2">
          Welcome back
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Sign in to view placement dashboard
        </p>

        <div className="space-y-3">
          {/* Microsoft Button */}
          <button
            onClick={() => oauthLogin("azure")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg border border-slate-200 hover:shadow-sm transition disabled:opacity-50"
            disabled={!!oauthLoading}
          >
            {oauthLoading === "azure" ? (
              <span className="text-sm font-medium text-slate-700">
                Redirecting to Microsoft…
              </span>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 23 23"
                  className="w-5 h-5"
                >
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="13" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="13" width="9" height="9" fill="#00a4ef" />
                  <rect x="13" y="13" width="9" height="9" fill="#ffb900" />
                </svg>
                <span className="text-sm font-medium text-slate-700">
                  Sign in with Microsoft
                </span>
              </>
            )}
          </button>

          {/* Google Button */}
          <button
            onClick={() => oauthLogin("google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-lg border border-slate-200 hover:shadow-sm transition disabled:opacity-50"
            disabled={!!oauthLoading}
          >
            {oauthLoading === "google" ? (
              "Redirecting to Google…"
            ) : (
              <>
                <FcGoogle className="w-5 h-5" />
                <span className="text-sm font-medium text-slate-700">
                  Sign in with Google
                </span>
              </>
            )}
          </button>
        </div>

        <div className="mt-6 border-t pt-6">
          <form onSubmit={submitLocal} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {err && <div className="text-sm text-red-600">{err}</div>}

            <div>
              <button
                type="submit"
                disabled={loading || !!oauthLoading}
                className="w-full py-2 px-4 bg-primary text-white rounded-lg hover:bg-blue-600"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>

          <p className="mt-4 text-xs text-slate-500">
            No public signup — accounts are provisioned by the admin.
          </p>
        </div>
      </div>
    </div>
  );
}
