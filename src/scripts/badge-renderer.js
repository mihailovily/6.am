import { badgeLayout } from './badge-domain.js';
/** @param {CanvasRenderingContext2D} ctx @param {CanvasImageSource & {width:number,height:number}} image @param {import('./badge-domain.js').Badge} state @param {number} x @param {number} y @param {number} width @param {number} height */
export function drawPhoto(ctx, image, state, x, y, width, height) {
  const ratio = Math.max(width / image.width, height / image.height) * state.zoom;
  const sw = width / ratio, sh = height / ratio;
  ctx.drawImage(image, (image.width - sw) * state.panX, (image.height - sh) * state.panY, sw, sh, x, y, width, height);
}
/** @param {CanvasRenderingContext2D} ctx @param {string} text @param {number} width @param {number} maxSize @param {number} lines */
export function fitText(ctx, text, width, maxSize, lines) {
  for (let size = maxSize; size >= 20; size -= 1) {
    ctx.font = `500 ${size}px Arial, sans-serif`;
    const rows = [''];
    for (const word of text.trim().split(/\s+/)) {
      const index = rows.length - 1;
      const candidate = rows[index] ? `${rows[index]} ${word}` : word;
      if (ctx.measureText(candidate).width <= width) rows[index] = candidate;
      else if (ctx.measureText(word).width <= width) rows.push(word);
      else {
        if (rows[index]) rows.push('');
        for (const character of Array.from(word)) {
          const last = rows.length - 1;
          if (ctx.measureText(rows[last] + character).width > width) rows.push(character);
          else rows[last] += character;
        }
      }
    }
    if (rows.length <= lines) return { rows, size, overflow: false };
  }
  return { rows: [text], size: 20, overflow: true };
}
/** @param {HTMLCanvasElement} canvas @param {import('./badge-domain.js').Badge} state @param {HTMLImageElement|null} photo @param {HTMLImageElement|null} qr @param {boolean} presentation */
export function renderBadge(canvas, state, photo, qr, presentation = false) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable.');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = state.background;
  ctx.fillRect(0, 0, w, h);
  const box = badgeLayout(w, h, state, presentation);
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.scale(box.width / 600, box.width / 600);
  const minimal = state.template === 'minimal';
  ctx.shadowColor = '#00000055'; ctx.shadowBlur = minimal ? 0 : box.width * .08; ctx.shadowOffsetY = box.width * .04;
  ctx.fillStyle = state.card;
  ctx.beginPath(); ctx.roundRect(0, 0, 600, 852, minimal ? 8 : 42); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, 600, 852, minimal ? 8 : 42); ctx.clip();
  if (photo) {
    if (minimal) {
      ctx.save(); ctx.beginPath(); ctx.arc(112, 120, 68, 0, Math.PI * 2); ctx.clip();
      drawPhoto(ctx, photo, state, 44, 52, 136, 136); ctx.restore();
    } else drawPhoto(ctx, photo, state, 0, 0, 600, 480);
  } else {
    ctx.fillStyle = state.ink; ctx.globalAlpha = .08; ctx.fillRect(minimal ? 44 : 0, minimal ? 52 : 0, minimal ? 136 : 600, minimal ? 136 : 480); ctx.globalAlpha = 1;
    ctx.fillStyle = state.ink; ctx.font = `500 ${minimal ? 54 : 140}px Arial, sans-serif`; ctx.textAlign = 'center';
    const initials = (state.name.trim() || 'Your name').split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
    ctx.fillText(initials, minimal ? 112 : 300, minimal ? 140 : 285); ctx.textAlign = 'left';
  }
  ctx.fillStyle = state.ink;
  let y = minimal ? 290 : 542;
  let overflow = false;
  for (const [text, size, lines] of /** @type {[string,number,number][]} */ ([[state.name.trim() || 'Your name', minimal ? 72 : 52, 2], [state.role.trim(), 28, 1], [state.company.trim(), 26, 1]])) {
    if (!text) continue;
    const fitted = fitText(ctx, text, qr && !minimal && size < 40 ? 340 : 512, size, lines);
    overflow ||= fitted.overflow;
    if (!fitted.overflow) {
      ctx.font = `500 ${fitted.size}px Arial, sans-serif`;
      for (const row of fitted.rows) { ctx.fillText(row.trim(), 44, y); y += fitted.size * 1.12; }
      y += 12;
    }
  }
  if (qr) {
    const size = minimal ? 204 : 132;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, 600 - size - 36, 852 - size - 30, size, size);
    ctx.imageSmoothingEnabled = true;
    // Do not silently allow text and the QR to overlap.
    if (y > (minimal ? 852 - size - 36 : 834)) overflow = true;
  }
  ctx.restore();
  if (!minimal) {
    ctx.fillStyle = state.ink; ctx.beginPath(); ctx.roundRect(242, 28, 116, 14, 7); ctx.fill();
    ctx.fillStyle = state.lanyard; ctx.fillRect(250, -50, 100, 83);
    const gradient = ctx.createLinearGradient(250, -50, 350, 33); gradient.addColorStop(0, '#ffffff33'); gradient.addColorStop(1, '#00000033'); ctx.fillStyle = gradient; ctx.fillRect(250, -50, 100, 83);
  }
  ctx.restore();
  return overflow;
}

