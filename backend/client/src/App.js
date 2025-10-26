import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
import OAuthCallback from "./pages/OAuthCallback";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCompanyDetails from "./pages/AdminCompanyDetails";
import AdminOffersDashboard from "./pages/AdminOffersDashboard";
import AdminStudents from "./pages/AdminStudents";
import CompanyDetails from "./pages/CompanyDetails";
import POCDashboard from "./pages/POCDashboard";
import POCCompanyStudents from "./pages/POCCompanyStudents";
import StudentDashboard from "./pages/StudentDashboard";
import StudentShortlistDetails from "./pages/StudentShortlistDetails";
import PrivateRoute from "./components/PrivateRoute";
import AuthCallback from "./pages/AuthCallback";

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
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
        <Route path="/admin/offers" element={
          <PrivateRoute>
            <AdminOffersDashboard />
          </PrivateRoute>
        } />
        <Route path="/admin/students" element={
          <PrivateRoute>
            <AdminStudents />
          </PrivateRoute>
        } />
        <Route path="/admin/companies/:companyId" element={
          <PrivateRoute>
            <CompanyDetails />
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
        <Route path="/poc/companies/:companyId/students" element={
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
    </>
  );
}

export default App;
