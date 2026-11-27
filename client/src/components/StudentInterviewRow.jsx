import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";
import PINConfirmModal from "./PINConfirmModal";

export default function StudentInterviewRow({ shortlist, maxRounds, onStageUpdate, onOfferCreated, isPOC = false, onClick, presence = null, companyId = null }) {
  const [updating, setUpdating] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [revertingOffer, setRevertingOffer] = useState(false);
  const [undoingRejection, setUndoingRejection] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const [showPINConfirm, setShowPINConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionMetadata, setActionMetadata] = useState(null);

  const isPlacedHere = shortlist.student?.isPlaced;
  const isPlacedElsewhere = shortlist.isStudentPlaced && !shortlist.student?.isPlaced;
  const placedCompanyName = shortlist.studentPlacedCompany;
  const hasRejectedOffer = shortlist.hasRejectedOffer;
  const currentStage = shortlist.currentStage;

  const withPINConfirmation = (action, actionType, title, message) => {
    if (isPOC) {
      setPendingAction(() => action);
      setActionMetadata({ type: actionType, title, message });
      setShowPINConfirm(true);
    } else {
      action();
    }
  };

  const executePendingAction = () => {
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
      setActionMetadata(null);
    }
  };

  const handleStageChange = async (newStage) => {
    if (isPlacedHere || isPlacedElsewhere || hasRejectedOffer || updating) return;
    const action = async () => {
      setUpdating(true);
      try {
        // Auto-end presence if student is busy-here and being rejected
        if (newStage === "REJECTED" && presenceStatus === "busy-here") {
          await api.post(`/poc/shortlist/${shortlist._id}/presence/exit`);
        }
        await api.patch(`/poc/shortlist/${shortlist._id}/stage`, { stage: newStage });
        // Auto-start presence when moving to a round and student is currently free
        if (newStage.startsWith("R") && presenceStatus === "free") {
          await handleEnterPresence(newStage);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to update stage");
      } finally {
        setUpdating(false);
      }
    };
    const stageLabel = newStage === "REJECTED" ? "Reject" : `Move to ${newStage}`;
    withPINConfirmation(action, newStage === "REJECTED" ? "reject" : "update", `${stageLabel} Student`, `Are you sure you want to ${stageLabel.toLowerCase()} ${shortlist.student?.name}?`);
  };

  const handleStatusChange = async (newStatus, clearStage = false) => {
    if (isPlacedHere || isPlacedElsewhere || hasRejectedOffer || updatingStatus) return;
    const action = async () => {
      setUpdatingStatus(true);
      try {
        await api.patch(`/poc/shortlist/${shortlist._id}/status`, { status: newStatus, clearStage });
        toast.success(`Student moved to ${newStatus === "shortlisted" ? "Shortlisted" : "Waitlisted"}`);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to update status");
      } finally {
        setUpdatingStatus(false);
      }
    };
    const statusLabel = newStatus === "shortlisted" ? "Shortlisted" : "Waitlisted";
    withPINConfirmation(action, "update", `Move to ${statusLabel}`, `Are you sure you want to move ${shortlist.student?.name} to ${statusLabel}?`);
  };

  const handleCreateOffer = async () => {
    if (isPlacedHere || isPlacedElsewhere || hasRejectedOffer || creatingOffer) return;
    const action = async () => {
      setCreatingOffer(true);
      try {
        // Auto-end presence if student is currently in an interview here
        if (presenceStatus === "busy-here") {
          await api.post(`/poc/shortlist/${shortlist._id}/presence/exit`);
        }
        await api.post(`/poc/shortlist/${shortlist._id}/offer`);
        toast.success(`Offer created for ${shortlist.student?.name}`);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to create offer");
      } finally {
        setCreatingOffer(false);
      }
    };
    withPINConfirmation(action, "offer", "Create Offer", `Are you sure you want to create an offer for ${shortlist.student?.name}? This will be sent to admin for approval.`);
  };

  const handleRevertOffer = async () => {
    if (revertingOffer) return;
    const action = async () => {
      setRevertingOffer(true);
      try {
        await api.delete(`/poc/shortlist/${shortlist._id}/offer`);
        toast.success(`Offer reverted for ${shortlist.student?.name}`);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to revert offer");
      } finally {
        setRevertingOffer(false);
      }
    };
    withPINConfirmation(action, "delete", "Revert Offer", `Are you sure you want to revert the offer for ${shortlist.student?.name}?`);
  };

  const handleUndoRejection = async () => {
    if (undoingRejection) return;
    const action = async () => {
      setUndoingRejection(true);
      try {
        await api.patch(`/poc/shortlist/${shortlist._id}/undo-rejection`);
        toast.success(`Rejection undone for ${shortlist.student?.name}`);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to undo rejection");
      } finally {
        setUndoingRejection(false);
      }
    };
    withPINConfirmation(action, "update", "Undo Rejection", `Are you sure you want to undo the rejection for ${shortlist.student?.name}?`);
  };

  // ── Presence ──────────────────────────────────────────────────────────────
  const presenceStatus = (() => {
    if (!presence || presence.status === "free") return "free";
    return presence.companyId?.toString() === companyId?.toString() ? "busy-here" : "busy-elsewhere";
  })();

  const handleEnterPresence = async (roundOverride) => {
    const round = roundOverride || (currentStage?.startsWith("R") ? currentStage : "R1");
    setCheckingIn(true);
    try {
      await api.post(`/poc/shortlist/${shortlist._id}/presence/enter`, { round });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start interview");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleExitPresence = async () => {
    setCheckingOut(true);
    try {
      await api.post(`/poc/shortlist/${shortlist._id}/presence/exit`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to end interview");
    } finally {
      setCheckingOut(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStageColor = (stage) => {
    const colors = {
      SHORTLISTED: "bg-blue-100 text-blue-800",
      WAITLISTED: "bg-yellow-100 text-yellow-800",
      R1: "bg-purple-100 text-purple-800",
      R2: "bg-purple-100 text-purple-800",
      R3: "bg-purple-100 text-purple-800",
      R4: "bg-purple-100 text-purple-800",
      OFFERED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800",
    };
    return colors[stage] || "bg-gray-100 text-gray-800";
  };

  const getRoundButtonColor = (round) => {
    if (currentStage === `R${round}`) return "bg-purple-600 text-white";
    const roundNum = parseInt((currentStage || "").replace("R", ""));
    if (!isNaN(roundNum) && round < roundNum) return "bg-purple-400 text-white";
    return "bg-slate-100 text-slate-700 hover:bg-slate-200";
  };

  const getStatusButtonConfig = () => {
    if (currentStage === "WAITLISTED") return { label: "Shortlist", action: () => handleStatusChange("shortlisted", false), color: "bg-blue-600 hover:bg-blue-700 text-white" };
    if (currentStage?.startsWith("R")) return { label: "Remove Round", action: () => handleStatusChange("shortlisted", true), color: "bg-orange-600 hover:bg-orange-700 text-white" };
    if (currentStage === "SHORTLISTED") return { label: "Waitlist", action: () => handleStatusChange("waitlisted", false), color: "bg-yellow-600 hover:bg-yellow-700 text-white" };
    return null;
  };

  const statusButtonConfig = getStatusButtonConfig();
  const stopProp = (e) => e.stopPropagation();

  // ── Render ────────────────────────────────────────────────────────────────
  const isActive = !isPlacedHere && !isPlacedElsewhere && !hasRejectedOffer && !["OFFERED", "REJECTED"].includes(currentStage);

  return (
    <div
      className={`px-4 py-4 sm:py-3 ${isPlacedHere || isPlacedElsewhere ? "bg-gray-50" : "hover:bg-slate-50"} ${onClick ? "cursor-pointer transition-colors duration-150" : ""}`}
      onClick={onClick || undefined}
    >
      {/* Layout: avatar | info */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-semibold flex-shrink-0 mt-0.5">
          {shortlist.student?.name?.charAt(0).toUpperCase()}
        </div>

        {/* Content: info + controls */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">

          {/* Student info */}
          <div className="flex-1 min-w-0">
            {/* Name + roll */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-900 text-sm">{shortlist.student?.name}</span>
              {shortlist.student?.rollNumber && (
                <span className="text-xs text-slate-400">({shortlist.student.rollNumber})</span>
              )}
              {/* Presence badges — desktop only (mobile gets own line below) */}
              {presence && presenceStatus === "busy-here" && (
                <span className="hidden sm:inline-flex" style={{ alignItems: "center", gap: 3, padding: "1px 7px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A", whiteSpace: "nowrap" }}>
                  In interview — {presence.round}
                </span>
              )}
              {presence && presenceStatus === "busy-elsewhere" && (
                <span className="hidden sm:inline-flex" style={{ alignItems: "center", gap: 3, padding: "1px 7px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#FEF0ED", color: "#C0300A", border: "1px solid #F4C5B6", whiteSpace: "nowrap" }}>
                  In interview elsewhere
                </span>
              )}
            </div>

            {/* Mobile-only presence badge — own line under name so it doesn't crowd the name */}
            {presence && presenceStatus !== "free" && (
              <div className="sm:hidden mt-1">
                {presenceStatus === "busy-here" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", fontSize: 11, fontWeight: 600, borderRadius: 2, background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A" }}>
                    In interview — {presence.round}
                  </span>
                )}
                {presenceStatus === "busy-elsewhere" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", fontSize: 11, fontWeight: 700, borderRadius: 2, background: "#FEF0ED", color: "#C0300A", border: "1px solid #F4C5B6" }}>
                    In interview elsewhere
                  </span>
                )}
              </div>
            )}

            {/* Email */}
            <div className="text-xs text-slate-400 truncate mt-0.5">{shortlist.student?.email}</div>
            {/* Notices */}
            {isPlacedElsewhere && placedCompanyName && (
              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Placed elsewhere ({placedCompanyName})
              </div>
            )}
            {hasRejectedOffer && (
              <div className="flex items-center gap-1 text-xs text-red-500 font-medium mt-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Offer rejected by admin
              </div>
            )}
          </div>

          {/* ── DESKTOP controls (sm+): original layout, unchanged ── */}
          <div className="hidden sm:flex flex-wrap items-center gap-1.5 flex-shrink-0" onClick={stopProp}>
            {/* Stage badge */}
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${getStageColor(currentStage)}`}>
              {currentStage}
            </span>

            {isActive && (
              <>
                {statusButtonConfig && (
                  <button
                    onClick={() => statusButtonConfig.action()}
                    disabled={updatingStatus}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition disabled:opacity-50 ${statusButtonConfig.color}`}
                  >
                    {updatingStatus ? "…" : statusButtonConfig.label}
                  </button>
                )}
                {[...Array(maxRounds)].map((_, i) => {
                  const r = i + 1;
                  return (
                    <button
                      key={r}
                      onClick={() => handleStageChange(`R${r}`)}
                      disabled={updating}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition disabled:opacity-50 ${getRoundButtonColor(r)}`}
                    >
                      R{r}
                    </button>
                  );
                })}
                {presenceStatus === "free" && (
                  <button
                    onClick={() => handleEnterPresence()}
                    disabled={checkingIn}
                    style={{ padding: "3px 10px", fontSize: 12, fontWeight: 700, borderRadius: 2, background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB", cursor: "pointer" }}
                    title="Mark student as entered the interview room"
                  >
                    {checkingIn ? "..." : "Start"}
                  </button>
                )}
                {presenceStatus === "busy-here" && (
                  <button
                    onClick={() => handleExitPresence()}
                    disabled={checkingOut}
                    style={{ padding: "3px 10px", fontSize: 12, fontWeight: 700, borderRadius: 2, background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A", cursor: "pointer" }}
                    title="Mark student as done with interview"
                  >
                    {checkingOut ? "..." : "End"}
                  </button>
                )}
                {presenceStatus === "busy-elsewhere" && (
                  <span
                    style={{ padding: "3px 10px", fontSize: 12, fontWeight: 600, borderRadius: 2, background: "#F4F2F1", color: "#8D9096", border: "1px solid #E9E9EB", cursor: "not-allowed" }}
                    title={`${shortlist.student?.name} is currently in another interview`}
                  >
                    In interview elsewhere
                  </span>
                )}
              </>
            )}

            {isPlacedHere ? (
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">Placed Here</span>
            ) : isPlacedElsewhere ? (
              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">Not Available</span>
            ) : hasRejectedOffer ? (
              <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">Offer Rejected</span>
            ) : currentStage === "OFFERED" ? (
              <button onClick={handleRevertOffer} disabled={revertingOffer} className="px-3 py-1 bg-orange-600 text-white text-xs font-semibold rounded hover:bg-orange-700 transition disabled:opacity-50">
                {revertingOffer ? "Reverting…" : "Revert Offer"}
              </button>
            ) : currentStage === "REJECTED" ? (
              <button onClick={handleUndoRejection} disabled={undoingRejection} className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition disabled:opacity-50">
                {undoingRejection ? "Undoing…" : "Undo Reject"}
              </button>
            ) : (
              <>
                <button onClick={() => handleStageChange("REJECTED")} disabled={updating} className="px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded hover:bg-red-100 transition disabled:opacity-50 border border-red-200">
                  Reject
                </button>
                <button
                  onClick={handleCreateOffer}
                  disabled={creatingOffer || currentStage === "SHORTLISTED" || currentStage === "WAITLISTED"}
                  className="px-3 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title={currentStage === "SHORTLISTED" || currentStage === "WAITLISTED" ? "Complete at least one round first" : "Create offer"}
                >
                  {creatingOffer ? "Creating…" : "Offer"}
                </button>
              </>
            )}
          </div>

          {/* ── MOBILE controls (below sm): reorganized for thumb use ── */}
          <div className="sm:hidden mt-2" onClick={stopProp}>
            {isPlacedHere ? (
              <span className="inline-flex px-3 py-1.5 bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-full">Placed Here</span>
            ) : isPlacedElsewhere ? (
              <span className="inline-flex px-3 py-1.5 bg-slate-100 text-slate-500 text-sm font-semibold rounded-full">Not Available</span>
            ) : hasRejectedOffer ? (
              <span className="inline-flex px-3 py-1.5 bg-red-100 text-red-700 text-sm font-semibold rounded-full">Offer Rejected</span>
            ) : (
              <div className="flex flex-col gap-2.5">
                {/* Row A: stage badge + primary CTA (Offer / Revert / Undo) */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${getStageColor(currentStage)}`}>
                    {currentStage}
                  </span>
                  {currentStage === "OFFERED" && (
                    <button onClick={handleRevertOffer} disabled={revertingOffer} className="px-4 py-1.5 bg-orange-600 text-white text-sm font-semibold rounded hover:bg-orange-700 transition disabled:opacity-50">
                      {revertingOffer ? "Reverting…" : "Revert Offer"}
                    </button>
                  )}
                  {currentStage === "REJECTED" && (
                    <button onClick={handleUndoRejection} disabled={undoingRejection} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition disabled:opacity-50">
                      {undoingRejection ? "Undoing…" : "Undo Reject"}
                    </button>
                  )}
                  {isActive && (
                    <button
                      onClick={handleCreateOffer}
                      disabled={creatingOffer || currentStage === "SHORTLISTED" || currentStage === "WAITLISTED"}
                      className="px-4 py-1.5 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      title={currentStage === "SHORTLISTED" || currentStage === "WAITLISTED" ? "Complete at least one round first" : "Create offer"}
                    >
                      {creatingOffer ? "Creating…" : "Offer"}
                    </button>
                  )}
                </div>

                {/* Row B: presence action — full width, most-used button on live day */}
                {isActive && (
                  <>
                    {presenceStatus === "free" && (
                      <button
                        onClick={handleEnterPresence}
                        disabled={checkingIn}
                        style={{ width: "100%", padding: "11px", fontSize: 15, fontWeight: 700, borderRadius: 3, background: "#EFF6F0", color: "#1A6B2A", border: "1px solid #B3D9BB", cursor: "pointer" }}
                      >
                        {checkingIn ? "Starting..." : "Start Interview"}
                      </button>
                    )}
                    {presenceStatus === "busy-here" && (
                      <button
                        onClick={handleExitPresence}
                        disabled={checkingOut}
                        style={{ width: "100%", padding: "11px", fontSize: 15, fontWeight: 700, borderRadius: 3, background: "#FFF8E6", color: "#7B5700", border: "1px solid #F5D87A", cursor: "pointer" }}
                      >
                        {checkingOut ? "Ending..." : "End Interview"}
                      </button>
                    )}
                    {presenceStatus === "busy-elsewhere" && (
                      <div style={{ width: "100%", padding: "10px", fontSize: 13, fontWeight: 600, borderRadius: 3, background: "#F4F2F1", color: "#8D9096", border: "1px solid #E9E9EB", textAlign: "center" }}>
                        In interview elsewhere
                      </div>
                    )}
                  </>
                )}

                {/* Row C: round grid — each pill gets equal width, thumb-sized */}
                {isActive && (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${maxRounds}, 1fr)`, gap: 6 }}>
                    {[...Array(maxRounds)].map((_, i) => {
                      const r = i + 1;
                      return (
                        <button
                          key={r}
                          onClick={() => handleStageChange(`R${r}`)}
                          disabled={updating}
                          className={`py-2.5 text-sm font-semibold rounded transition disabled:opacity-50 ${getRoundButtonColor(r)}`}
                        >
                          R{r}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Row D: "More" toggle — reveals secondary actions (status, reject) */}
                {isActive && (
                  <div>
                    <button
                      onClick={() => setShowMore(m => !m)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 py-1"
                    >
                      {showMore ? "Less" : "More options"}
                    </button>
                    {showMore && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {statusButtonConfig && (
                          <button
                            onClick={() => statusButtonConfig.action()}
                            disabled={updatingStatus}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded transition disabled:opacity-50 ${statusButtonConfig.color}`}
                          >
                            {updatingStatus ? "…" : statusButtonConfig.label}
                          </button>
                        )}
                        <button
                          onClick={() => handleStageChange("REJECTED")}
                          disabled={updating}
                          className="flex-1 py-2.5 bg-red-50 text-red-700 text-sm font-semibold rounded hover:bg-red-100 transition disabled:opacity-50 border border-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Phone + Remarks — indented under avatar */}
      {shortlist.student?.phoneNumber && (
        <div className="flex items-center gap-1.5 mt-1.5 ml-12 text-xs text-slate-400">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          {shortlist.student.phoneNumber}
        </div>
      )}
      {shortlist.remarks && (
        <div className="mt-1 ml-12 text-xs text-slate-400 italic">Note: {shortlist.remarks}</div>
      )}

      <PINConfirmModal
        isOpen={showPINConfirm}
        onClose={() => { setShowPINConfirm(false); setPendingAction(null); setActionMetadata(null); }}
        onConfirm={executePendingAction}
        title={actionMetadata?.title || "Confirm Action"}
        message={actionMetadata?.message || "Please enter PIN to confirm this action."}
        actionType={actionMetadata?.type || "update"}
      />
    </div>
  );
}
