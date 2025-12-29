import { useEffect, useState } from 'react';

interface EnvInfo {
  pr: string;
  commit: string;
  branch: string;
  version: string;
  previewUrl: string;
}

function App() {
  const [info, setInfo] = useState<EnvInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch('/api/info', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setInfo)
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err.message);
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="app">
      {/* Animated background */}
      <div className="bg-gradient"></div>
      <div className="bg-grid"></div>

      {/* Floating orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
      <div className="orb orb-4"></div>

      {/* Floating particles */}
      <div className="particles">
        {[...Array(20)].map((_, i) => (
          <div key={i} className="particle" style={{
            '--delay': `${i * 0.5}s`,
            '--x': `${Math.random() * 100}%`,
            '--duration': `${15 + Math.random() * 20}s`,
          } as React.CSSProperties}></div>
        ))}
      </div>

      <div className={`container ${mounted ? 'mounted' : ''}`}>
        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="logo-text">k8s-ee</span>
          </div>

          <div className="status-badge">
            <span className="status-dot"></span>
            <span>Live</span>
          </div>
        </header>

        {/* Hero Section */}
        <section className="hero">
          <div className="hero-badge">
            <svg className="hero-badge-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Ephemeral Environment</span>
          </div>

          <h1 className="hero-title">
            <span className="hero-title-line">Pull Request</span>
            <span className="hero-title-number">#{info?.pr || '...'}</span>
          </h1>

          <p className="hero-subtitle">
            This environment was automatically created for your pull request.
            <br />
            It will be destroyed when the PR is closed or merged.
          </p>
        </section>

        {/* Main Content */}
        <main className="main">
          {loading && (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Fetching environment info...</p>
            </div>
          )}

          {error && (
            <div className="error-card">
              <svg className="error-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
              </svg>
              <div>
                <h3>Connection Error</h3>
                <p>{error}</p>
              </div>
            </div>
          )}

          {info && !loading && (
            <>
              {/* Info Cards Grid */}
              <div className="cards-grid">
                <div className="card card-branch">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M6 3V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M18 9V21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M18 9C18 12 15 15 12 15C9 15 6 15 6 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="card-content">
                    <span className="card-label">Branch</span>
                    <span className="card-value">{info.branch}</span>
                  </div>
                </div>

                <div className="card card-commit">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M12 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M12 16V22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="card-content">
                    <span className="card-label">Commit</span>
                    <span className="card-value mono">{info.commit}</span>
                  </div>
                </div>

                <div className="card card-version">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="card-content">
                    <span className="card-label">Version</span>
                    <span className="card-value">{info.version}</span>
                  </div>
                </div>

                <div className="card card-url">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="card-content">
                    <span className="card-label">Preview URL</span>
                    <a href={info.previewUrl} className="card-value card-link" target="_blank" rel="noopener noreferrer">
                      {info.previewUrl.replace('https://', '')}
                      <svg className="external-icon" viewBox="0 0 24 24" fill="none">
                        <path d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M15 3H21V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 14L21 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </a>
                  </div>
                </div>
              </div>

              {/* Pipeline Visualization */}
              <div className="pipeline">
                <h2 className="pipeline-title">Deployment Pipeline</h2>
                <div className="pipeline-steps">
                  <div className="pipeline-step completed">
                    <div className="step-icon">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="step-label">PR Opened</span>
                  </div>

                  <div className="pipeline-connector"></div>

                  <div className="pipeline-step completed">
                    <div className="step-icon">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="step-label">Image Built</span>
                  </div>

                  <div className="pipeline-connector"></div>

                  <div className="pipeline-step completed">
                    <div className="step-icon">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="step-label">Deployed</span>
                  </div>

                  <div className="pipeline-connector active"></div>

                  <div className="pipeline-step active">
                    <div className="step-icon pulse">
                      <svg viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="4" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className="step-label">Running</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-content">
            <span className="footer-text">Powered by</span>
            <div className="tech-stack">
              <span className="tech-badge">k3s</span>
              <span className="tech-badge">Helm</span>
              <span className="tech-badge">GitHub Actions</span>
              <span className="tech-badge">Traefik</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
