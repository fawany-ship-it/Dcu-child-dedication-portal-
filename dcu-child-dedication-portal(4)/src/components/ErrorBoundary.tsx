import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred in the portal.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Portal ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && parsed.error) {
          friendly = `Cloud database access error (${parsed.operationType} on ${parsed.path || 'database'}): ${parsed.error}`;
        }
      } catch {
        // plain string message
      }

      return (
        <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl border-2 border-[#d4af37]/50 shadow-xl p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-amber-700" />
            </div>
            <h2 className="font-cinzel font-bold text-xl text-[#2a170e]">
              Deliverance Church Utawala Portal
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2a170e] text-[#ffd700] border border-[#d4af37] text-xs font-bold cursor-pointer hover:bg-[#3d2314]"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
