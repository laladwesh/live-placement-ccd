import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { ConfigProvider } from "antd";
import antdTheme from "./theme/antdTheme";

import Layout           from "./components/Layout";
import Footer           from "./components/Footer";

// Route-split so a first-time visit only downloads the JS for the one screen it's actually
// landing on, instead of every page in the app (every admin dashboard, scheduler, intern-stats
// page, etc.) bundled eagerly into one chunk that has to load before React can render anything —
// that monolithic bundle was the "blank white screen on first load" everyone was seeing.
const Login                    = lazy(() => import("./pages/Login"));
const OAuthCallback            = lazy(() => import("./pages/OAuthCallback"));
const AuthCallback             = lazy(() => import("./pages/AuthCallback"));
const Dashboard                = lazy(() => import("./pages/Dashboard"));
const AdminDashboard           = lazy(() => import("./pages/AdminDashboard"));
const AdminCompanyDetails      = lazy(() => import("./pages/AdminCompanyDetails"));
const AdminOffersDashboard     = lazy(() => import("./pages/AdminOffersDashboard"));
const AdminStudents            = lazy(() => import("./pages/AdminStudents"));
const ViewersConfirmed         = lazy(() => import("./pages/ViewersConfirmed"));
const CompanyDetails           = lazy(() => import("./pages/CompanyDetails"));
const POCDashboard             = lazy(() => import("./pages/POCDashboard"));
const POCCompanyStudents       = lazy(() => import("./pages/POCCompanyStudents"));
const StudentDashboard         = lazy(() => import("./pages/StudentDashboard"));
const StudentShortlistDetails  = lazy(() => import("./pages/StudentShortlistDetails"));
const TeamPage                 = lazy(() => import("./pages/TeamPage"));
const SharePage                = lazy(() => import("./pages/SharePage"));
const MailSenderPage           = lazy(() => import("./pages/MailSenderPage"));
const InternMasterData         = lazy(() => import("./pages/InternMasterData"));
const InternStatsLive          = lazy(() => import("./pages/InternStatsLive"));
const InternStatsLiveDetail    = lazy(() => import("./pages/InternStatsLiveDetail"));
const PlacementStatsDetail     = lazy(() => import("./pages/PlacementStatsDetail"));
const PrevPlacementData        = lazy(() => import("./pages/PrevPlacementData"));
const SchedulerCompanies       = lazy(() => import("./pages/SchedulerCompanies"));
const SchedulerCompanyView     = lazy(() => import("./pages/SchedulerCompanyView"));
const AdminStudentTracker      = lazy(() => import("./pages/AdminStudentTracker"));
const AdminDDayStats           = lazy(() => import("./pages/AdminDDayStats"));
const NotFound                 = lazy(() => import("./pages/NotFound"));

const RouteLoadingFallback = () => (
  <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#5E6878", fontSize: 14 }}>
    Loading…
  </div>
);

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#1E2532', color: '#fff', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 14 },
          success: { duration: 3000, iconTheme: { primary: '#107C10', secondary: '#fff' } },
          error:   { duration: 4000, iconTheme: { primary: '#D83B01', secondary: '#fff' } },
        }}
      />

      <BrowserRouter basename={process.env.REACT_APP_BASE_PATH || ''}>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* ── Public ───────────────────────────────── */}
          <Route path="/login"         element={<Login />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          <Route path="/auth/cb"       element={<AuthCallback />} />
          <Route path="/team"          element={<TeamPage />} />
          <Route path="/s"             element={<SharePage />} />
          <Route path="/mail"          element={<MailSenderPage />} />
          <Route path="/"              element={<Navigate to="/login" replace />} />

          {/* ── Protected — all wrapped by Layout ────── */}
          <Route element={<Layout />}>
            <Route path="/dashboard"                          element={<Dashboard />} />
            <Route path="/admin"                              element={<AdminDashboard />} />
            <Route path="/admin/offers"                       element={<AdminOffersDashboard />} />
            <Route path="/admin/students"                     element={<AdminStudents />} />
            <Route path="/admin/tracker"                      element={<AdminStudentTracker />} />
            <Route path="/admin/dday"                         element={<AdminDDayStats />} />
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
            <Route path="/placement-stats/:rollNumber"        element={<PlacementStatsDetail />} />
            <Route path="/prev-placement"                     element={<PrevPlacementData />} />
            <Route path="/scheduler"                          element={<SchedulerCompanies />} />
            <Route path="/scheduler/companies/:companyId"     element={<SchedulerCompanyView />} />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>

        <Footer />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
