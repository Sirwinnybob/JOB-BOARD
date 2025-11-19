import React from 'react';
import { useDarkMode } from '../contexts/DarkModeContext';

/**
 * MobileActionBar - floating action bar that appears when a card is selected on mobile
 */
function MobileActionBar({ pdf, onDelete, onLabelClick, onMoveToPending, onEditPlaceholder, onClose }) {
  const { darkMode } = useDarkMode();

  if (!pdf) return null;

  const isPlaceholder = pdf.is_placeholder;

  return (
    <div
      className={`fixed top-20 left-0 right-0 z-50 mx-4 ${
        darkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'
      } border-2 rounded-lg shadow-2xl p-3 transition-colors`}
    >
      <div className="flex items-center justify-between gap-2">
        {/* Card title/info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {isPlaceholder
              ? pdf.placeholder_text || 'Placeholder'
              : pdf.job_number || 'Job'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {isPlaceholder ? (
            <>
              {/* Edit Placeholder */}
              {onEditPlaceholder && (
                <button
                  onClick={() => {
                    onEditPlaceholder(pdf);
                    onClose();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
                  aria-label="Edit Placeholder"
                  title="Edit Placeholder"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Manage Labels */}
              {onLabelClick && (
                <button
                  onClick={() => {
                    onLabelClick(pdf);
                    onClose();
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
                  aria-label="Manage Labels"
                  title="Manage Labels"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </button>
              )}

              {/* Move to Pending */}
              {onMoveToPending && (
                <button
                  onClick={() => {
                    onMoveToPending(pdf.id);
                    onClose();
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
                  aria-label="Move to Pending"
                  title="Move to Pending"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
              )}
            </>
          )}

          {/* Delete */}
          {onDelete && (
            <button
              onClick={() => {
                onDelete(pdf.id);
                onClose();
              }}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition-colors"
              aria-label="Delete"
              title="Delete"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className={`${
              darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            } transition-colors ml-2`}
            aria-label="Close"
            title="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileActionBar;
