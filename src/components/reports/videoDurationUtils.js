export function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDurationSec(notes) {
  if (!notes) return null;
  const noteText = notes.toLowerCase();
  const hourMatch = noteText.match(/(\d+)\s*hour/);
  const minMatch = noteText.match(/(\d+)\s*min/);
  const secMatch = noteText.match(/(\d+)\s*sec/);
  let totalSeconds = 0;
  if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
  if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSeconds += parseInt(secMatch[1]);
  return totalSeconds > 0 ? totalSeconds : null;
}

export function formatDur(sec) {
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  if (sec >= 60) return `${Math.round(sec / 60)} min`;
  return `${sec} sec`;
}

export function durationColor(sec) {
  if (sec < 60)   return '#dd6b20';
  if (sec < 600)  return '#38a169';
  if (sec < 1740) return '#3182ce';
  if (sec < 3600) return '#d69e2e';
  return '#805ad5';
}

export const BRACKETS = [
  { label: '< 1 min',   color: '#dd6b20', test: s => s < 60 },
  { label: '1–10 min',  color: '#38a169', test: s => s >= 60 && s < 600 },
  { label: '11–29 min', color: '#3182ce', test: s => s >= 600 && s < 1740 },
  { label: '30–59 min', color: '#d69e2e', test: s => s >= 1740 && s < 3600 },
  { label: '60+ min',   color: '#805ad5', test: s => s >= 3600 },
];
