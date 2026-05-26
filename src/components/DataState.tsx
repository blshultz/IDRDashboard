import React from 'react';
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react';

export function LoadingSpinner({ message = 'Loading data…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <AlertCircle className="w-5 h-5 text-red-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-800 text-sm">Failed to load Google Sheets data</p>
        <p className="text-red-600 text-sm mt-0.5 break-words">{message}</p>
        <p className="text-red-400 text-xs mt-2">
          Make sure <code className="bg-red-100 px-1 rounded">GOOGLE_SERVICE_ACCOUNT_EMAIL</code>,{' '}
          <code className="bg-red-100 px-1 rounded">GOOGLE_PRIVATE_KEY</code>, and{' '}
          <code className="bg-red-100 px-1 rounded">GOOGLE_SHEET_ID</code> are set as Edge Function secrets.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}
