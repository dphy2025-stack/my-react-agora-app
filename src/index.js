import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Root render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#07131e", color: "#e6f7ff", padding: 20, textAlign: "center" }}>
          <div>
            <h2 style={{ marginTop: 0 }}>App crashed unexpectedly</h2>
            <p style={{ opacity: 0.85 }}>Please refresh once. If it repeats, the latest fix has kept logs in browser console for debugging.</p>
            <button onClick={() => window.location.reload()} style={{ border: "1px solid #6ee7b7", borderRadius: 999, padding: "10px 18px", background: "#0f8f63", color: "#fff", cursor: "pointer" }}>
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
);
