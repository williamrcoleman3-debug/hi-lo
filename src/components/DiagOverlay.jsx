import { useEffect, useState } from "react";
import { readDiagLog } from "../diag.js";

// TEMPORARY -- see src/diag.js. Shows the last diagLog() entries directly on
// screen (polling localStorage, since the events it's watching come from an
// appUrlOpen listener outside React's render cycle). Remove this component
// and its mount in App.jsx once the instant-sign-in investigation is done.
export function DiagOverlay() {
  const [lines, setLines] = useState(readDiagLog());

  useEffect(() => {
    const id = setInterval(() => setLines(readDiagLog()), 1000);
    return () => clearInterval(id);
  }, []);

  if (lines.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "40vh",
        overflowY: "auto",
        background: "rgba(0,0,0,0.88)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: "10px",
        lineHeight: "1.4",
        padding: "6px 8px",
        zIndex: 9999,
        whiteSpace: "pre-wrap",
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
