import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import './styles.css';
import './studio.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Frameflow studio error', error, info);
  }
  render() {
    return this.state.error ? (
      <div className="app-loading">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <h1>Let’s find your flow again.</h1>
        <p>The studio encountered an unexpected error. Your last local save is kept.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reopen studio
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
