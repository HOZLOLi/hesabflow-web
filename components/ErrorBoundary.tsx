import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the React tree and shows the
 * ErrorScreen instead of letting the WebView fade to a blank white page.
 *
 * Last line of defence against the "white screen" symptom: if a component
 * throws while rendering, the user gets a readable error (and a reload button)
 * rather than nothing. We also force-hide the HTML `#initial-loader` here —
 * otherwise its high z-index would cover the error message.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (typeof document !== 'undefined') {
      document.body.classList.add('react-loaded');
    }
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <ErrorScreen
          error={this.state.error?.message || 'خطای غیرمنتظره در نمایش برنامه'}
          details={this.state.error?.stack}
          onRetry={() => window.location.reload()}
        />
      );
    }

    return this.props.children;
  }
}
