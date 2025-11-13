// src/pages/StudentShortlistDetails.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import AlertModal from "../components/AlertModal";

export default function StudentShortlistDetails() {
  const { shortlistId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shortlist, setShortlist] = useState(null);
  const [offer, setOffer] = useState(null);
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });

  useEffect(() => {
    fetchUser();
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortlistId]);

  const fetchUser = async () => {
    try {
      const res = await api.get("/users/me");
      setUser(res.data);
    } catch (err) {
      console.error("Error fetching user:", err);
      navigate("/dday/login");
    }
  };

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/student/shortlists/${shortlistId}`);
      setShortlist(res.data.shortlist);
      setOffer(res.data.offer);
    } catch (err) {
      console.error("Error fetching shortlist details:", err);
      if (err.response?.status === 404) {
        setErrorAlert({
          show: true,
          message: "Shortlist not found"
        });
        setTimeout(() => navigate("/student"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      SHORTLISTED: "bg-blue-100 text-blue-800 border-blue-200",
      WAITLISTED: "bg-yellow-100 text-yellow-800 border-yellow-200",
      R1: "bg-purple-100 text-purple-800 border-purple-200",
      R2: "bg-purple-100 text-purple-800 border-purple-200",
      R3: "bg-purple-100 text-purple-800 border-purple-200",
      R4: "bg-purple-100 text-purple-800 border-purple-200",
      OFFERED: "bg-green-100 text-green-800 border-green-200",
      REJECTED: "bg-red-100 text-red-800 border-red-200"
    };
    return colors[stage] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const formatDate = (date) => {
    if (!date) return "Not specified";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatCTC = (ctc) => {
    if (!ctc) return "Not specified";
    return `₹${ctc} LPA`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 mt-4">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!shortlist) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar user={user} />
        <div className="max-w-5xl mx-auto px-4 py-12 text-center">
          <p className="text-slate-600">Shortlist not found</p>
        </div>
      </div>
    );
  }

  const company = shortlist.companyId;
  const stageTimeline = [
    { stage: "SHORTLISTED", label: "Shortlisted", icon: "" },
    { stage: "R1", label: "Round 1", icon: "" },
    { stage: "R2", label: "Round 2", icon: "" },
    { stage: "R3", label: "Round 3", icon: "" },
  ];

  const currentStageIndex = stageTimeline.findIndex(s => s.stage === shortlist.stage);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/student")}
          className="mb-6 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>

        {/* Company Header Card */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                {company?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{company?.name}</h1>
                <p className="text-slate-600 mt-1">{company?.jobRole || "Software Engineer"}</p>
              </div>
            </div>
            <span className={`px-4 py-2 text-sm font-medium rounded-full border ${getStageColor(shortlist.stage)}`}>
              {shortlist.stage}
            </span>
          </div>

          {/* Company Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-slate-600 font-medium">₹</span>
              </div>
              <div>
                <p className="text-sm text-slate-600">CTC</p>
                <p className="font-semibold text-slate-900">{formatCTC(company?.ctc)}</p>
              </div>
            </div>
            {company?.location && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Location</p>
                  <p className="font-semibold text-slate-900">{company.location}</p>
                </div>
              </div>
            )}
            {company?.visitDate && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Visit Date</p>
                  <p className="font-semibold text-slate-900">{formatDate(company.visitDate)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-600">Interview Rounds</p>
                <p className="font-semibold text-slate-900">{company?.maxRounds || 3} rounds</p>
              </div>
            </div>
          </div>

          {/* Company Description */}
          {company?.description && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-2">About the Company</h3>
              <p className="text-slate-700 leading-relaxed">{company.description}</p>
            </div>
          )}

          {/* Bond Information */}
          {company?.bond && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">Bond:</span> {company.bond}
              </p>
            </div>
          )}
        </div>

        {/* Interview Progress Timeline */}
        {!shortlist.isOffered && shortlist.stage !== "REJECTED" && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Interview Progress</h2>
            <div className="relative">
                  {/* Progress Line (hidden on small screens) */}
                  <div className="hidden md:block absolute top-6 left-0 right-0 h-1 bg-slate-200">
                    <div
                      className="h-full bg-purple-500 transition-all"
                      style={{ width: `${(currentStageIndex / (stageTimeline.length - 1)) * 100}%` }}
                    />
                  </div>

                  {/* Timeline Steps - stack vertically on small screens */}
                  <div className="relative flex flex-col md:flex-row md:justify-between gap-6">
                {stageTimeline.map((step, index) => {
                  const isPast = index < currentStageIndex;
                  const isCurrent = step.stage === shortlist.stage;

                  return (
                    <div key={step.stage} className="flex flex-col items-center">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 ${
                          isPast || isCurrent
                            ? "bg-purple-500 border-purple-500 text-white"
                            : "bg-white border-slate-300 text-slate-400"
                        }`}
                      >
                        {step.icon}
                      </div>
                      <p
                        className={`mt-2 text-sm font-medium ${
                          isPast || isCurrent ? "text-slate-900" : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Offer Details */}
        {shortlist.isOffered && offer && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow-sm p-6 mb-6 border border-green-200">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-10 h-10 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-green-800 mb-2">Congratulations!</h2>
                <p className="text-green-700 mb-4">
                  You have received an offer from <span className="font-semibold">{company?.name}</span>
                </p>
                <div className="bg-white rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Package:</span>
                    <span className="font-semibold text-slate-900">{formatCTC(company?.ctc)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Offer Date:</span>
                    <span className="font-semibold text-slate-900">{formatDate(offer.createdAt)}</span>
                  </div>
                  {offer.status && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Status:</span>
                      <span className={`font-semibold ${offer.status === "ACCEPTED" ? "text-green-600" : "text-slate-900"}`}>
                        {offer.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rejected Status */}
        {shortlist.stage === "REJECTED" && (
          <div className="bg-red-50 rounded-lg shadow-sm p-6 mb-6 border border-red-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-200 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-800 mb-2">Not Selected</h2>
                <p className="text-red-700">
                  Unfortunately, you were not selected for this position. Keep applying to other opportunities!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Additional Information</h2>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-600">Added to Shortlist</p>
                <p className="font-medium text-slate-900">{formatDate(shortlist.createdAt)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-600">Last Updated</p>
                <p className="font-medium text-slate-900">{formatDate(shortlist.updatedAt)}</p>
              </div>
            </div>

            {shortlist.remarks && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Remarks</p>
                  <p className="font-medium text-slate-900">{shortlist.remarks}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Error Alert */}
      <AlertModal
        isOpen={errorAlert.show}
        onClose={() => setErrorAlert({ show: false, message: '' })}
        title="Error"
        message={errorAlert.message}
        type="error"
      />
    </div>
  );
}
