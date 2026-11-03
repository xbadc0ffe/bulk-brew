import { useEffect, useState } from 'react';

/** A short-lived status line, for "Copied" and similar. Clears itself after a moment. */
export function useStatus(ms = 2500): [string | undefined, (s: string) => void] {
  const [status, setStatus] = useState<string>();
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(undefined), ms);
    return () => clearTimeout(t);
  }, [status, ms]);
  return [status, setStatus];
}
