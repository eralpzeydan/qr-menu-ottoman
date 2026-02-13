'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Menu page error:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Menü Yüklenemedi
        </h2>

        <p className="text-gray-600 mb-6">
          Menü yüklenirken bir hata oluştu. Lütfen tekrar deneyin.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
            <p className="text-sm font-mono text-red-800 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-600 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <button
          onClick={reset}
          className="w-full px-6 py-3 text-white font-semibold rounded-lg transition-colors"
          style={{ backgroundColor: '#8D1F25' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#6d171d';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#8D1F25';
          }}
        >
          Tekrar Dene
        </button>

        <p className="mt-4 text-sm text-gray-500">
          Sorun devam ederse lütfen personelle iletişime geçin.
        </p>
      </div>
    </div>
  );
}
