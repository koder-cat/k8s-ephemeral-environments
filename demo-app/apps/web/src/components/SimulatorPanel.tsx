import { useState, ReactNode } from 'react';

interface SimulatorPanelProps {
  title: string;
  icon: ReactNode;
  accentColor: 'purple' | 'cyan' | 'amber' | 'green' | 'red';
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function SimulatorPanel({
  title,
  icon,
  accentColor,
  defaultExpanded = false,
  children,
}: SimulatorPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`simulator-panel ${expanded ? 'expanded' : ''}`}>
      <button
        className="panel-header"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className={`panel-icon ${accentColor}`}>{icon}</div>
        <span className="panel-title">{title}</span>
        <div className={`panel-chevron ${expanded ? 'rotated' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>
      <div className={`panel-content ${expanded ? 'expanded' : ''}`}>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}

// Icon components for the panels
export function StatusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
      <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  );
}

export function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export function CpuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
