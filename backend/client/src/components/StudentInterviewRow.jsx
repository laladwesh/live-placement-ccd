// src/components/StudentInterviewRow.jsx
import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import ConfirmDialog from "./ConfirmDialog";

export default function StudentInterviewRow({ shortlist, maxRounds, onStageUpdate, onOfferCreated }) {
  const [updating, setUpdating] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [showOfferConfirm, setShowOfferConfirm] = useState(false);

  const isPlaced = shortlist.student?.isPlaced;
  // const isBlocked = shortlist.student?.isBlocked;
  const currentStage = shortlist.currentStage;

  const handleStageChange = async (newStage) => {
    if (isPlaced || updating) return;

    setUpdating(true);
    try {
      await api.patch(`/poc/shortlist/${shortlist._id}/stage`, { stage: newStage });
      // Don't call onStageUpdate() - let socket handle the refresh
      // The socket will update all connected clients including this one
    } catch (err) {
      console.error("Error updating stage:", err);
      toast.error(err.response?.data?.message || "Failed to update stage");
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateOffer = async () => {
    if (isPlaced || creatingOffer) return;

    setCreatingOffer(true);
    try {
      await api.post(`/poc/shortlist/${shortlist._id}/offer`);
      toast.success(`Offer created for ${shortlist.student?.name}`);
      // Don't call onOfferCreated() - let socket handle the refresh
      // The socket will update all connected clients including this one
    } catch (err) {
      console.error("Error creating offer:", err);
      toast.error(err.response?.data?.message || "Failed to create offer");
    } finally {
      setCreatingOffer(false);
    }
  };

  const getStageColor = (stage) => {
    const colors = {
      SHORTLISTED: "bg-blue-100 text-blue-800",
      WAITLISTED: "bg-yellow-100 text-yellow-800",
      R1: "bg-purple-100 text-purple-800",
      R2: "bg-purple-100 text-purple-800",
      R3: "bg-purple-100 text-purple-800",
      OFFERED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800"
    };
    return colors[stage] || "bg-gray-100 text-gray-800";
  };

  const getRoundButtonColor = (round) => {
    if (currentStage === `R${round}`) {
      return "bg-purple-600 text-white";
    }
    const roundNum = parseInt(currentStage.replace('R', ''));
    if (!isNaN(roundNum) && round < roundNum) {
      return "bg-purple-400 text-white";
    }
    return "bg-slate-100 text-slate-700 hover:bg-slate-200";
  };

  return (
    <div className={`p-4 ${isPlaced ? 'bg-gray-50' : 'hover:bg-slate-50'}`}>
      <div className="flex items-center gap-4">
        {/* Student Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium flex-shrink-0">
              {shortlist.student?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 truncate">
                {shortlist.student?.name}
                {shortlist.student?.rollNumber && (
                  <span className="ml-2 text-xs font-normal text-slate-500">({shortlist.student.rollNumber})</span>
                )}
              </div>
              <div className="text-sm text-slate-500 truncate">
                {shortlist.student?.email}
              </div>
            </div>
          </div>
        </div>

        {/* Stage Badge */}
        <div className="flex-shrink-0">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStageColor(currentStage)}`}>
            {currentStage}
          </span>
        </div>

        {/* Round Buttons */}
        {!isPlaced && !["OFFERED", "REJECTED"].includes(currentStage) && (
          <div className="flex gap-2 flex-shrink-0">
            {[...Array(maxRounds)].map((_, index) => {
              const round = index + 1;
              return (
                <button
                  key={round}
                  onClick={() => handleStageChange(`R${round}`)}
                  disabled={updating}
                  className={`px-3 py-1 text-sm font-medium rounded transition disabled:opacity-50 ${getRoundButtonColor(round)}`}
                  title={`Move to Round ${round}`}
                >
                  R{round}
                </button>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0">
          {isPlaced ? (
            <div className="px-4 py-2 bg-emerald-100 text-emerald-800 text-sm font-medium rounded">
              Already Placed
            </div>
          ) : currentStage === "OFFERED" ? (
            <div className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded">
              Offer Sent
            </div>
          ) : currentStage === "REJECTED" ? (
            <div className="px-4 py-2 bg-red-100 text-red-800 text-sm font-medium rounded">
              Rejected
            </div>
          ) : (
            <>
              {/* Reject Button */}
              <button
                onClick={() => handleStageChange("REJECTED")}
                disabled={updating}
                className="px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded hover:bg-red-200 transition disabled:opacity-50"
                title="Reject candidate"
              >
                Reject
              </button>
              
              {/* Offer Button */}
              <button
                onClick={() => setShowOfferConfirm(true)}
                disabled={creatingOffer || currentStage === "SHORTLISTED" || currentStage === "WAITLISTED"}
                className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={currentStage === "SHORTLISTED" || currentStage === "WAITLISTED" ? "Complete at least one round first" : "Create offer"}
              >
                {creatingOffer ? "Creating..." : "Offer"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Phone Number */}
      {shortlist.student?.phoneNumber && (
        <div className="mt-2 ml-14 text-sm text-slate-600">
          📞 {shortlist.student.phoneNumber}
        </div>
      )}

      {/* Remarks */}
      {shortlist.remarks && (
        <div className="mt-2 ml-14 text-sm text-slate-500 italic">
          Note: {shortlist.remarks}
        </div>
      )}

      {/* Confirm Offer Dialog */}
      <ConfirmDialog
        isOpen={showOfferConfirm}
        onClose={() => setShowOfferConfirm(false)}
        onConfirm={handleCreateOffer}
        title="Create Offer"
        message={`Are you sure you want to create an offer for ${shortlist.student?.name}? This will be sent to admin for approval.`}
        confirmText="Create Offer"
        confirmColor="green"
        icon="success"
      />
    </div>
  );
}
