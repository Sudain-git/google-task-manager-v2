function FetchingIndicator({ message = 'Fetching data...', subMessage = 'This may take a moment for large lists' }) {
  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--spacing-lg)',
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-md)'
    }}>
      <div className="spinner" style={{ margin: 0, width: '24px', height: '24px' }}></div>
      <div>
        <h3 style={{ 
          fontSize: '0.875rem', 
          marginBottom: 'var(--spacing-xs)',
          color: 'var(--text-primary)',
          margin: subMessage ? '0 0 var(--spacing-xs) 0' : 0
        }}>
          {message}
        </h3>
        {subMessage && (
          <p style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-tertiary)',
            margin: 0
          }}>
            {subMessage}
          </p>
        )}
      </div>
    </div>
  );
}

export default FetchingIndicator;