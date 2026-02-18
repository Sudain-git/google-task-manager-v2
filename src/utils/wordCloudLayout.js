export const GOLDEN_ANGLE = 137.508;

export function getFontSize(count, min, max) {
  if (min === max) return 1.5;
  const ratio = (count - min) / (max - min);
  return 0.7 + ratio * (3 - 0.7);
}

function measureWords(words, minCount, maxCount, fontFamily) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const padding = 8;

  return words.map((w, i) => {
    const fontSize = getFontSize(w.count, minCount, maxCount);
    const fontSizePx = fontSize * 16;
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    const measured = ctx.measureText(w.text);
    return {
      text: w.text,
      count: w.count,
      fontSize: `${fontSize}rem`,
      color: `hsl(${i * GOLDEN_ANGLE}, 55%, 50%)`,
      w: measured.width + padding,
      h: fontSizePx * 1.2,
    };
  });
}

function overlaps(a, placed) {
  for (const b of placed) {
    if (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    ) {
      return true;
    }
  }
  return false;
}

export function spiralLayout(words, width, height, fontFamily) {
  if (!words.length) return [];

  const minCount = words[words.length - 1].count;
  const maxCount = words[0].count;
  const measured = measureWords(words, minCount, maxCount, fontFamily);

  // Sort by fontSize descending (largest first)
  const sorted = [...measured].sort((a, b) => {
    const aSize = parseFloat(a.fontSize);
    const bSize = parseFloat(b.fontSize);
    return bSize - aSize;
  });

  const cx = width / 2;
  const cy = height / 2;
  const placed = [];

  for (const word of sorted) {
    let found = false;

    for (let t = 0; t < 1000; t += 0.3) {
      const x = cx + t * Math.cos(t) - word.w / 2;
      const y = cy + t * Math.sin(t) - word.h / 2;

      const candidate = { x, y, w: word.w, h: word.h };

      if (
        x >= 0 &&
        y >= 0 &&
        x + word.w <= width &&
        y + word.h <= height &&
        !overlaps(candidate, placed)
      ) {
        placed.push(candidate);
        word.x = x;
        word.y = y;
        found = true;
        break;
      }
    }

    if (!found) {
      // Place off-screen — will be hidden by overflow:hidden
      word.x = -9999;
      word.y = -9999;
    }
  }

  return sorted.map(({ text, count, x, y, fontSize, color }) => ({
    text,
    count,
    x,
    y,
    fontSize,
    color,
  }));
}

export function radialLayout(words, width, height, fontFamily) {
  if (!words.length) return [];

  const minCount = words[words.length - 1].count;
  const maxCount = words[0].count;
  const measured = measureWords(words, minCount, maxCount, fontFamily);

  const cx = width / 2;
  const cy = height / 2;
  const ringStep = 45;
  const placed = [];

  // Place first word at center
  measured[0].x = cx - measured[0].w / 2;
  measured[0].y = cy - measured[0].h / 2;
  placed.push({ x: measured[0].x, y: measured[0].y, w: measured[0].w, h: measured[0].h });

  let remaining = measured.slice(1);
  let ring = 1;

  while (remaining.length > 0 && ring < 20) {
    const radius = ring * ringStep;
    const avgW = remaining.reduce((s, w) => s + w.w, 0) / remaining.length;
    const slots = Math.max(6, Math.floor((2 * Math.PI * radius) / avgW));
    const deferred = [];

    for (const word of remaining) {
      let didPlace = false;
      for (let j = 0; j < slots; j++) {
        const angle = (2 * Math.PI / slots) * j;
        const x = cx + radius * Math.cos(angle) - word.w / 2;
        const y = cy + radius * Math.sin(angle) - word.h / 2;
        const candidate = { x, y, w: word.w, h: word.h };

        if (!overlaps(candidate, placed)) {
          word.x = x;
          word.y = y;
          placed.push(candidate);
          didPlace = true;
          break;
        }
      }
      if (!didPlace) deferred.push(word);
    }

    remaining = deferred;
    ring++;
  }

  // Any words that couldn't be placed — hide via overflow:hidden
  for (const word of remaining) {
    word.x = -9999;
    word.y = -9999;
  }

  return measured.map(({ text, count, x, y, fontSize, color }) => ({
    text,
    count,
    x,
    y,
    fontSize,
    color,
  }));
}
