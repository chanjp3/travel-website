import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/**
 * Last-resort net: a render crash must never leave a blank page. Shows a
 * branded recovery card with the error, and a restart that clears state.
 */
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#04060B", color: "#EDF1F8", fontFamily: "'Inter', system-ui, sans-serif", padding: 24,
      }}>
        <div style={{
          maxWidth: 460, background: "#0A0F1A", border: "1px solid rgba(140,165,210,.18)",
          borderRadius: 4, padding: 28, boxShadow: "0 18px 50px rgba(0,0,0,.6)",
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "#CE3D2A", marginBottom: 8 }}>
            Unscheduled turbulence
          </div>
          <h1 style={{ fontFamily: "'Jost', sans-serif", fontWeight: 600, fontSize: 24, marginBottom: 10 }}>
            Something went wrong.
          </h1>
          <p style={{ fontSize: 13, color: "#5D6B73", lineHeight: 1.5, marginBottom: 6 }}>
            The planner hit an unexpected error. Restarting takes you back to the map.
          </p>
          <pre style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#5D6B73",
            background: "#04060B", border: "1px solid rgba(140,165,210,.14)", borderRadius: 3,
            padding: 10, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 16, maxHeight: 120, overflow: "auto",
          }}>{String(this.state.error?.message ?? this.state.error)}</pre>
          <button
            onClick={() => location.reload()}
            style={{
              background: "#7FB0FF", color: "#04060B", border: "none", borderRadius: 3,
              padding: "12px 22px", fontFamily: "'Jost', sans-serif", fontWeight: 600,
              fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            Restart the journey
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>
);
