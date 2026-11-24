import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const FACES = ["(╯°□°）╯︵ ┻━┻", "(っ °Д °;)っ", "ʕ •ᴥ•ʔ??", "¯\\_(ツ)_/¯", "(ง'̀-'́)ง"];
const MSGS = [
  "This page pulled a no-show. Classic.",
  "Bruh. That URL doesn't go anywhere.",
  "404: Student not found. Skipped the interview.",
  "You wandered off the placement portal.",
  "Even the placement cell can't find this page.",
];
const TIPS = [
  "Try not to ghost your interviews like this URL.",
  "Have you tried turning it off and on again?",
  "The page took a gap year and never came back.",
  "It got rejected in Round 1.",
  "Currently in an interview. At another portal.",
];

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const [faceIdx] = useState(() => Math.floor(Math.random() * FACES.length));
  const [bounce, setBounce] = useState(false);
  const [tableFly, setTableFly] = useState(false);
  const [count, setCount] = useState(0);

  // Countdown to home
  useEffect(() => {
    setCount(10);
    const id = setInterval(() => setCount(c => { if (c <= 1) { clearInterval(id); navigate("/login"); } return c - 1; }), 1000);
    return () => clearInterval(id);
  }, [navigate]);

  // Bounce the face every 2s
  useEffect(() => {
    const id = setInterval(() => { setBounce(true); setTimeout(() => setBounce(false), 400); }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", background: "#F4F2F1", fontFamily: "Inter, -apple-system, sans-serif",
      padding: "24px 16px", textAlign: "center", overflow: "hidden", position: "relative",
    }}>

      {/* Floating background blobs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: 60 + i * 30,
            height: 60 + i * 30,
            borderRadius: "50%",
            background: i % 2 === 0 ? "rgba(20,33,61,0.04)" : "rgba(20,33,61,0.07)",
            left: `${[8, 75, 20, 60, 5, 85][i]}%`,
            top: `${[10, 15, 70, 75, 45, 50][i]}%`,
            animation: `float${i % 3} ${3 + i * 0.7}s ease-in-out infinite alternate`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes float0 { from { transform: translateY(0px) rotate(0deg); } to { transform: translateY(-18px) rotate(5deg); } }
        @keyframes float1 { from { transform: translateY(0px) rotate(0deg); } to { transform: translateY(14px) rotate(-4deg); } }
        @keyframes float2 { from { transform: translateY(0px) rotate(0deg); } to { transform: translateY(-10px) rotate(8deg); } }
        @keyframes spin1s { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wiggle { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
        @keyframes bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-18px); } }
        @keyframes flyaway { 0% { transform: translate(0,0) rotate(0deg); opacity:1; } 100% { transform: translate(300px,-300px) rotate(720deg); opacity:0; } }
        .face-bounce { animation: bounce 0.4s ease; }
        .table-fly { animation: flyaway 0.8s ease forwards; }
      `}</style>

      {/* 404 big number */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ fontSize: "clamp(80px, 20vw, 160px)", fontWeight: 900, color: "#14213D", lineHeight: 1, letterSpacing: -4, opacity: 0.08, userSelect: "none" }}>
          404
        </div>
        {/* Animated face over the number */}
        <div
          className={bounce ? "face-bounce" : ""}
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "clamp(28px, 7vw, 52px)", cursor: "pointer", userSelect: "none",
          }}
          title="Click me!"
          onClick={() => setTableFly(t => !t)}
        >
          <span className={tableFly ? "table-fly" : ""}>{FACES[faceIdx]}</span>
        </div>
      </div>

      {/* Message */}
      <h1 style={{ fontSize: "clamp(18px, 4vw, 28px)", fontWeight: 700, color: "#1E2532", margin: "0 0 8px", maxWidth: 480 }}>
        {MSGS[faceIdx]}
      </h1>
      <p style={{ fontSize: "clamp(13px, 2.5vw, 15px)", color: "#8D9096", maxWidth: 400, marginBottom: 6 }}>
        {TIPS[faceIdx]}
      </p>

      {/* The URL they tried */}
      <div style={{ margin: "12px 0 20px", padding: "6px 14px", background: "#fff", border: "1px dashed #DBDDE0", borderRadius: 4, fontSize: 12, fontFamily: "monospace", color: "#C0300A", maxWidth: "90vw", overflowX: "auto", whiteSpace: "nowrap" }}>
        {location.pathname}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: "8px 20px", fontSize: 14, fontWeight: 600, borderRadius: 2, background: "#fff", border: "1px solid #DBDDE0", color: "#353B47", cursor: "pointer" }}
        >
          ← Go Back
        </button>
        <button
          onClick={() => navigate("/login")}
          style={{ padding: "8px 20px", fontSize: 14, fontWeight: 600, borderRadius: 2, background: "#14213D", border: "none", color: "#fff", cursor: "pointer" }}
        >
          Take Me Home
        </button>
      </div>

      {/* Auto-redirect countdown */}
      <p style={{ fontSize: 12, color: "#C8CAD0" }}>
        Auto-redirecting in <strong style={{ color: "#14213D" }}>{count}s</strong> before this gets more awkward…
      </p>

      {/* Spinning IITG logo */}
      <div style={{ marginTop: 32, opacity: 0.15, animation: "spin1s 8s linear infinite" }}>
        <img src="https://iitg.ac.in/placements/static/media/iitglogo.d364692baec36d70b8ff.png" alt="" style={{ width: 36, height: 36 }} />
      </div>
    </div>
  );
}
