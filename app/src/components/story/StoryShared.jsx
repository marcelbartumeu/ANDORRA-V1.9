export function NarrativeCard({ children }) {
  return (
    <div className="story-narrative-card">
      {children}
    </div>
  );
}

export function VisualPlaceholder({ label, className = "" }) {
  return (
    <div className={`story-visual-placeholder ${className}`}>
      <span className="story-placeholder-kicker">
        visualization placeholder
      </span>

      <strong>{label}</strong>
    </div>
  );
}

export function PhotoPanel({ src, label, className = "" }) {
  return (
    <div
      className={`story-photo-card ${className}`}
      role="img"
      aria-label={label}
      style={{
        backgroundImage: `
          linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            rgba(0, 0, 0, 0.35)
          ),
          url("${src}")
        `,
      }}
    />
  );
}