interface ResponseDisplayProps {
  data: unknown;
  loading?: boolean;
  error?: string | null;
  variant?: 'default' | 'success' | 'error';
}

export function ResponseDisplay({
  data,
  loading,
  error,
  variant = 'default',
}: ResponseDisplayProps) {
  if (loading) {
    return (
      <div className="response-display loading">
        <div className="response-loading">
          <div className="loading-spinner small"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="response-display error">
        <pre>{error}</pre>
      </div>
    );
  }

  if (data === null || data === undefined) {
    return null;
  }

  const displayClass = variant === 'error'
    ? 'response-display error'
    : variant === 'success'
      ? 'response-display success'
      : 'response-display';

  return (
    <div className={displayClass}>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
