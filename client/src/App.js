import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Layout          from "./components/Layout";
import Login           from "./pages/Login";
import OAuthCallback   from "./pages/OAuthCallback";
import AuthCallback    from "./pages/AuthCallback";
import Dashboard       from "./pages/Dashboard";
import AdminDashboard  from "./pages/AdminDashboard";
import AdminCompanyDetails  from "./pages/AdminCompanyDetails";
import AdminOffersDashboard from "./pages/AdminOffersDashboard";
import AdminStudents   from "./pages/AdminStudents";
import ViewersConfirmed from "./pages/ViewersConfirmed";
import CompanyDetails  from "./pages/CompanyDetails";
import POCDashboard    from "./pages/POCDashboard";
import POCCompanyStudents   from "./pages/POCCompanyStudents";
import StudentDashboard     from "./pages/StudentDashboard";
import StudentShortlistDetails from "./pages/StudentShortlistDetails";
import TeamPage        from "./pages/TeamPage";
import InternMasterData from "./pages/InternMasterData";
import InternStatsLive from "./pages/InternStatsLive";
import InternStatsLiveDetail from "./pages/InternStatsLiveDetail";
import Footer          from "./components/Footer";

function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1E2532', color: '#fff', fontFamily: 'Lato, sans-serif', fontSize: 14 },
          success: { duration: 3000, iconTheme: { primary: '#107C10', secondary: '#fff' } },
          error:   { duration: 4000, iconTheme: { primary: '#D83B01', secondary: '#fff' } },
        }}
      />

      <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || ''}>
        <Routes>
          {/* ── Public ───────────────────────────────── */}
          <Route path="/login"         element={<Login />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/auth/cb"       element={<AuthCallback />} />
          <Route path="/team"          element={<TeamPage />} />
          <Route path="/"              element={<Navigate to="/login" replace />} />

          {/* ── Protected — all wrapped by Layout ────── */}
          <Route element={<Layout />}>
            <Route path="/dashboard"                          element={<Dashboard />} />
            <Route path="/admin"                              element={<AdminDashboard />} />
            <Route path="/admin/offers"                       element={<AdminOffersDashboard />} />
            <Route path="/admin/students"                     element={<AdminStudents />} />
            <Route path="/admin/company"                      element={<AdminCompanyDetails />} />
            <Route path="/admin/companies/:companyId"         element={<CompanyDetails />} />
            <Route path="/company/:companyId"                 element={<CompanyDetails />} />
            <Route path="/poc"                                element={<POCDashboard />} />
            <Route path="/poc/company/:companyId"             element={<POCCompanyStudents />} />
            <Route path="/poc/companies/:companyId/students"  element={<POCCompanyStudents />} />
            <Route path="/student"                            element={<StudentDashboard />} />
            <Route path="/student/shortlist/:shortlistId"     element={<StudentShortlistDetails />} />
            <Route path="/viewers/confirmed"                  element={<ViewersConfirmed />} />
            <Route path="/intern-master-data"                 element={<InternMasterData />} />
            <Route path="/intern-stats-live"                  element={<InternStatsLive />} />
            <Route path="/intern-stats-live/:rollNumber"      element={<InternStatsLiveDetail />} />
          </Route>
        </Routes>

        <Footer />
      </BrowserRouter>
    </>
  );
}

export default App;
