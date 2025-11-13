import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem("jwt_token");
  if (!token) return <Navigate to="/dday/login" replace />;
  return children;
}
