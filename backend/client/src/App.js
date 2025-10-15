import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCompanyDetails from "./pages/AdminCompanyDetails";
import CompanyDetails from "./pages/CompanyDetails";
import POCDashboard from "./pages/POCDashboard";
import POCCompanyStudents from "./pages/POCCompanyStudents";
import StudentDashboard from "./pages/StudentDashboard";
import StudentShortlistDetails from "./pages/StudentShortlistDetails";
import PrivateRoute from "./components/PrivateRoute";
import AuthCallback from "./pages/AuthCallback";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<OAuthCallback />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/admin" element={
          <PrivateRoute>
            <AdminDashboard />
          </PrivateRoute>
        } />
        <Route path="/admin/company" element={
          <PrivateRoute>
            <AdminCompanyDetails />
          </PrivateRoute>
        } />
        <Route path="/company/:companyId" element={
          <PrivateRoute>
            <CompanyDetails />
          </PrivateRoute>
        } />
        <Route path="/poc" element={
          <PrivateRoute>
            <POCDashboard />
          </PrivateRoute>
        } />
        <Route path="/poc/company/:companyId" element={
          <PrivateRoute>
            <POCCompanyStudents />
          </PrivateRoute>
        } />
        <Route path="/student" element={
          <PrivateRoute>
            <StudentDashboard />
          </PrivateRoute>
        } />
        <Route path="/student/shortlist/:shortlistId" element={
          <PrivateRoute>
            <StudentShortlistDetails />
          </PrivateRoute>
        } />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
