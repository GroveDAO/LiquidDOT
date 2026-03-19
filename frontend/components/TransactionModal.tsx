"use client";

import React from "react";

interface TransactionModalProps {
  isOpen: boolean;
  status: "pending" | "success" | "error";
  txHash?: string;
  errorMessage?: string;
  onClose: () => void;
}

export default function TransactionModal({
  isOpen,
  status,
  txHash,
  errorMessage,
  onClose,
}: TransactionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {status === "pending" && (
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Transaction Pending
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Please confirm in your wallet and wait for confirmation...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Transaction Successful
            </h3>
            {txHash && (
              <a
                href={`#${txHash}`}
                className="text-pink-500 text-sm hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Blockscout →
              </a>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Transaction Failed
            </h3>
            {errorMessage && (
              <p className="text-red-500 text-sm">{errorMessage}</p>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
