import { useState, useEffect, useMemo, useRef } from 'react';
import { spiralLayout, radialLayout } from '../utils/wordCloudLayout';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'to', 'and', 'of', 'in', 'for', 'it', 'on', 'at',
  'be', 'as', 'or', 'by', 'was', 'are', 'but', 'not', 'you', 'all', 'can',
  'her', 'has', 'his', 'how', 'its', 'may', 'new', 'now', 'our', 'out',
  'own', 'say', 'she', 'too', 'use', 'way', 'who', 'did', 'get', 'had',
  'him', 'let', 'my', 'no', 'do', 'if', 'me', 'so', 'up', 'we', 'am',
  'he', 'us', 'that', 'this', 'with', 'from', 'they', 'been', 'have',
  'were', 'said', 'each', 'which', 'their', 'will', 'what', 'there',
  'than', 'them', 'then', 'into', 'just', 'about', 'would', 'your',
]);

export default function WordCloud({ tasks }) {
  const [wordSource, setWordSource] = useState('title');
  const [layout, setLayout] = useState('spiral');
  const [urlMode, setUrlMode] = useState(false);
  const [excludeText, setExcludeText] = useState('');
  const [wordData, setWordData] = useState([]);
  const cloudRef = useRef(null);
  const [cloudSize, setCloudSize] = useState({ width: 0, height: 0 });

  // Recompute word data when tasks or source changes
  useEffect(() => {
    if (tasks.length === 0) {
      setWordData([]);
      return;
    }

    const freq = new Map();

    for (const task of tasks) {
      let raw = '';
      if (wordSource === 'title') raw = task.title || '';
      else if (wordSource === 'notes') raw = task.notes || '';
      else raw = `${task.title || ''} ${task.notes || ''}`;

      if (urlMode) {
        const urlRegex = /https?:\/\/[^\s]+/gi;
        const urls = raw.match(urlRegex) || [];
        for (const url of urls) {
          try {
            let hostname = new URL(url).hostname.toLowerCase();
            if (hostname.startsWith('www.')) hostname = hostname.slice(4);
            if (hostname) freq.set(hostname, (freq.get(hostname) || 0) + 1);
          } catch { /* skip malformed URLs */ }
        }
        raw = raw.replace(/https?:\/\/[^\s]+/gi, '');
      }

      const words = raw
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

      for (const w of words) {
        freq.set(w, (freq.get(w) || 0) + 1);
      }
    }

    const sorted = [...freq.entries()]
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 80);

    setWordData(sorted);
  }, [tasks, wordSource, urlMode]);

  // Measure cloud container when wordData or layout changes
  useEffect(() => {
    if (cloudRef.current) {
      const { width, height } = cloudRef.current.getBoundingClientRect();
      setCloudSize({ width, height });
    }
  }, [wordData, layout]);

  const excludedSet = useMemo(() => {
    const set = new Set();
    for (const w of excludeText.split(',')) {
      const trimmed = w.trim().toLowerCase();
      if (trimmed) set.add(trimmed);
    }
    return set;
  }, [excludeText]);

  const filteredWords = useMemo(
    () => wordData.filter(w => !excludedSet.has(w.text)),
    [wordData, excludedSet],
  );

  const positions = useMemo(() => {
    if (!filteredWords.length || !cloudSize.width) return [];
    const layoutFn = layout === 'spiral' ? spiralLayout : radialLayout;
    return layoutFn(filteredWords, cloudSize.width, cloudSize.height, "'JetBrains Mono', monospace");
  }, [filteredWords, cloudSize, layout]);

  if (tasks.length === 0) return null;

  return (
    <>
      <div className="form-row" style={{ marginBottom: 'var(--spacing-sm)' }}>
        <div className="form-group">
          <label htmlFor="word-source">Word Source</label>
          <select
            id="word-source"
            value={wordSource}
            onChange={(e) => setWordSource(e.target.value)}
          >
            <option value="title">Title</option>
            <option value="notes">Notes</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="layout-mode">Layout</label>
          <select
            id="layout-mode"
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
          >
            <option value="spiral">Spiral</option>
            <option value="radial">Radial</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="url-mode">URL Mode</label>
          <select
            id="url-mode"
            value={urlMode ? 'on' : 'off'}
            onChange={e => setUrlMode(e.target.value === 'on')}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </div>
      </div>

      {wordData.length > 0 && (
        <div className="card">
          <div className="wordcloud wordcloud--positioned" ref={cloudRef}>
            {positions.map(w => (
              <span
                key={w.text}
                title={`${w.text}: ${w.count} occurrence${w.count !== 1 ? 's' : ''}`}
                onClick={() => {
                  setExcludeText(prev => {
                    const parts = prev.split(',').map(s => s.trim()).filter(Boolean);
                    if (parts.includes(w.text)) return prev;
                    return [...parts, w.text].join(', ');
                  });
                }}
                style={{
                  position: 'absolute',
                  left: w.x,
                  top: w.y,
                  fontSize: w.fontSize,
                  color: w.color,
                  cursor: 'pointer',
                }}
              >
                {w.text}
              </span>
            ))}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label htmlFor="exclude-words">Exclude words</label>
            <input
              id="exclude-words"
              type="text"
              value={excludeText}
              onChange={e => setExcludeText(e.target.value)}
              placeholder="Click a word or type comma-separated words to exclude"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
