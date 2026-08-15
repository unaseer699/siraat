'use client';

import { useState } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading: boolean;
  initialValue?: string;
}

export function SearchBar({ onSearch, loading, initialValue = '' }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '680px' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Try "10 Marla plot in Islamabad under 2.5 Crore"'
        aria-label="Property search"
        style={{
          flex: 1,
          padding: '12px 16px',
          border: '2px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '16px',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        style={{
          padding: '12px 24px',
          background: 'var(--brand)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontSize: '16px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
