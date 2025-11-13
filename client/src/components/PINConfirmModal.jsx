// src/components/PINConfirmModal.jsx
import React, { useState, useEffect } from "react";

export default function PINConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  actionType = "update"
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const CORRECT_PIN = "1234";

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (pin === CORRECT_PIN) {
      onConfirm();
      onClose();
      setPin("");
      setError("");
    } else {
      setError("Incorrect PIN. Please try again.");
      setPin("");
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
      setPin("");
      setError("");
    }
  };

  const getActionColor = () => {
    switch(actionType) {
      case "reject":
      case "delete":
        return "bg-red-600 hover:bg-red-700";
      case "offer":
      case "approve":
        return "bg-green-600 hover:bg-green-700";
      case "update":
      default:
        return "bg-blue-600 hover:bg-blue-700";
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
            {title}
          </h3>

          {/* Message */}
          <p className="text-sm text-slate-600 text-center mb-4">
            {message}
          </p>

          {/* PIN Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-blue-800 text-center font-medium">
               Enter PIN: <span className="font-mono font-bold">1234</span>
            </p>
          </div>

          {/* PIN Input Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError("");
                }}
                placeholder="Enter PIN"
                maxLength="4"
                className={`w-full px-4 py-2 text-center text-lg font-mono border-2 rounded-lg focus:outline-none focus:ring-2 ${
                  error 
                    ? "border-red-300 focus:border-red-500 focus:ring-red-200" 
                    : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                }`}
                autoFocus
              />
              {error && (
                <p className="text-xs text-red-600 text-center mt-2">
                  {error}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  setPin("");
                  setError("");
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pin.length !== 4}
                className={`px-4 py-2 text-white rounded-lg transition ${getActionColor()} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
