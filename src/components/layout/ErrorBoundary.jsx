import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, RotateCcw, ArrowLeft, LayoutDashboard, ShoppingBag } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Curated Art UI Crash caught by ErrorBoundary:', error, errorInfo);
  }

  componentDidMount() {
    window.addEventListener('popstate', this.handlePopState);
  }

  componentWillUnmount() {
    window.removeEventListener('popstate', this.handlePopState);
  }

  componentDidUpdate(prevProps) {
    // If route location changes, automatically clear error state so new page can render
    if (this.state.hasError && this.props.location && prevProps.location) {
      if (
        this.props.location.pathname !== prevProps.location.pathname ||
        this.props.location.search !== prevProps.location.search
      ) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  handlePopState = () => {
    if (this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  };

  handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onNavigate) {
      this.props.onNavigate(-1);
    } else if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/';
      }
    }
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onNavigate) {
      this.props.onNavigate('/');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleGoPOS = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onNavigate) {
      this.props.onNavigate('/pos');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/pos';
    }
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isNested = this.props.nested;
      return (
        <div
          className={
            isNested
              ? 'w-full min-h-[420px] flex items-center justify-center p-4 text-stone-100'
              : 'min-h-screen w-screen flex items-center justify-center bg-stone-950 p-6 text-stone-100'
          }
        >
          <div className="max-w-md w-full bg-stone-900 border border-rose-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-serif font-bold text-stone-100">Something Went Wrong</h2>
              <p className="text-xs text-stone-400 leading-relaxed mt-1">
                An unexpected display error occurred on this screen. Your database, inventory, and POS transactions remain safe and intact.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-stone-950 border border-stone-800 rounded-lg text-rose-400 font-mono text-[11px] text-left break-all max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            {/* Backtrack & Safe Navigation Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={this.handleGoBack}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Backtrack to Previous Page (Undo)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={this.handleGoDashboard}
                  className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-700"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleGoPOS}
                  className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-700"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
                  <span>POS Desk (F2)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-2 px-3 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Reloading This Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Route-aware Error Boundary that sits inside React Router.
 * Automatically catches page errors without crashing the sidebar/header navigation,
 * and clears error state as soon as the user navigates to another page.
 */
export function RouteErrorBoundary({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <ErrorBoundary location={location} onNavigate={navigate} nested>
      {children}
    </ErrorBoundary>
  );
}
