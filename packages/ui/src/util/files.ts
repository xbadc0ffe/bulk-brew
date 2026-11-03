// Browser file helpers shared by both apps.

/** Offer a text file for download through a temporary object URL. */
export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}

export function backupFilename(now: Date): string {
  return `bulk-brew-backup-${now.toISOString().slice(0, 10)}.json`;
}
