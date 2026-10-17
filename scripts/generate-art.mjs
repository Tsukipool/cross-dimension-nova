/**
 * Generates the original SVG artwork used by the portfolio.
 * Run `npm run art` to rebuild every file in public/art.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'art');
await mkdir(outDir, { recursive: true });

const rngFrom = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const n = (v) => Math.round(v * 100) / 100;

function commonDefs(id) {
  return `
    <linearGradient id="${id}-haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".55" stop-color="#fff" stop-opacity=".08"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="${id}-vignette" cx=".5" cy=".45" r=".78">
      <stop offset=".5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".5"/>
    </radialGradient>
    <filter id="${id}-grain">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer>
    </filter>
    <filter id="${id}-blur24" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <filter id="${id}-blur60" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="60"/>
    </filter>
    <filter id="${id}-softglow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="c-blur24" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="24"/>
    </filter>
    <filter id="c-blur60" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="60"/>
    </filter>`;
}

function grainLayer(id, w, h, opacity = 0.16) {
  return `<rect width="${w}" height="${h}" filter="url(#${id}-grain)" opacity="${opacity}" style="mix-blend-mode:overlay"/>`;
}

function vignetteLayer(id, w, h) {
  return `<rect width="${w}" height="${h}" fill="url(#${id}-vignette)"/>`;
}

function stars(rng, w, h, count, maxY = h * 0.78, palette = '#fff4e0') {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * maxY;
    const r = rng() * 1.7 + 0.25;
    const o = rng() * 0.65 + 0.15;
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${palette}" opacity="${n(o)}"/>`;
    if (rng() > 0.92) {
      out += `<path d="M${n(x - 7)} ${n(y)}H${n(x + 7)}M${n(x)} ${n(y - 7)}V${n(y + 7)}" stroke="${palette}" stroke-width=".6" opacity="${n(o * 0.55)}"/>`;
    }
  }
  return out;
}

function cloud(rng, x, y, w, color, opacity = 0.2, blur = 24) {
  let out = `<g filter="url(#${blur === 60 ? 'c-blur60' : 'c-blur24'})" opacity="${opacity}">`;
  const lobes = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < lobes; i++) {
    const cx = x + (rng() - 0.5) * w;
    const cy = y + (rng() - 0.5) * w * 0.16;
    const rx = w * (0.15 + rng() * 0.22);
    out += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(rx * (0.16 + rng() * 0.12))}" fill="${color}"/>`;
  }
  return out + '</g>';
}

function mountains(w, baseY, color, peaks, roughness = 0.22, rng = Math.random) {
  const step = w / (peaks - 1);
  let d = `M0 ${baseY + 120}`;
  for (let i = 0; i < peaks; i++) {
    const x = i * step;
    const y = baseY - Math.pow(rng(), 1.7) * baseY * roughness;
    if (i === 0) d += `L${n(x)} ${n(y)}`;
    else d += `Q${n(x - step / 2)} ${n(y + rng() * 30)} ${n(x)} ${n(y)}`;
  }
  d += `L${w} ${baseY + 200}L${w} ${baseY + 400}L0 ${baseY + 400}Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

function label(w, h, text, sub, color = '#efe9dc', align = 'left') {
  const x = align === 'right' ? w - 48 : 48;
  const anchor = align === 'right' ? 'end' : 'start';
  return `<g opacity=".62" fill="${color}" font-family="'Noto Serif CJK SC','Noto Serif SC',serif">
    <text x="${x}" y="${h - 62}" font-size="15" letter-spacing="4" text-anchor="${anchor}">${text}</text>
    <text x="${x}" y="${h - 38}" font-size="10" letter-spacing="2.4" text-anchor="${anchor}" opacity=".72">${sub}</text>
  </g>`;
}

function openingTag(w, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">`;
}

function closeSvg(id, w, h) {
  return `${vignetteLayer(id, w, h)}${grainLayer(id, w, h)}</svg>`;
}

/* ------------------------------------------------------------------ */
/* 01 · 星屑电车                                                       */
/* ------------------------------------------------------------------ */
function stardustTram(w, h, id, variant = 0) {
  const rng = rngFrom(1103 + variant * 37);
  const dusk = [
    ['#070716', '#1d1739', '#553a66', '#d9899a', '#f3c4a7'],
    ['#0d1020', '#263450', '#6d6c8e', '#e6a6a4', '#f6d9bd'],
    ['#03040b', '#11132b', '#2c2346', '#8d546f', '#d5a0a8'],
  ][variant];
  const sunY = h * (variant === 1 ? 0.47 : 0.42);
  const sunX = w * 0.72;
  const sunR = w * 0.24;
  const scale = variant === 2 ? 1.55 : 1;
  const focus = variant === 1 ? `translate(${w * 0.12} ${h * 0.02}) scale(1.16)` : '';
  const body = `
  <g ${variant === 1 ? `transform="${focus}"` : ''}>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dusk[0]}"/><stop offset=".35" stop-color="${dusk[1]}"/>
      <stop offset=".62" stop-color="${dusk[2]}"/><stop offset=".82" stop-color="${dusk[3]}"/>
      <stop offset="1" stop-color="${dusk[4]}"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
    ${stars(rng, w, h, 170, h * 0.58)}
    <circle cx="${sunX}" cy="${sunY}" r="${sunR * 1.9}" fill="${dusk[4]}" opacity=".14" filter="url(#${id}-blur60)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="#ffead8" opacity=".93"/>
    <circle cx="${sunX}" cy="${sunY}" r="${sunR * 1.015}" fill="none" stroke="#ffe8d3" stroke-opacity=".3" stroke-width="1.5"/>
    ${cloud(rng, w * 0.3, h * 0.44, w * 0.55, '#f4cfc4', 0.2)}
    ${cloud(rng, w * 0.74, h * 0.53, w * 0.45, '#f8d9c7', 0.2)}
    ${cloud(rng, w * 0.5, h * 0.34, w * 0.8, '#6d567b', 0.16, 60)}
    <g>${mountains(w, h * 0.6, '#251f3b', 7, 0.28, rng)}${mountains(w, h * 0.66, '#17162a', 9, 0.2, rng)}</g>
    <linearGradient id="${id}-ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d0c18"/><stop offset="1" stop-color="#05050b"/>
    </linearGradient>
    <path d="M0 ${h * 0.72} Q${w * 0.25} ${h * 0.68} ${w * 0.55} ${h * 0.73} T${w} ${h * 0.7}V${h}H0Z" fill="url(#${id}-ground)"/>
    <g opacity=".9">
      <path d="M${w * 0.08} ${h}L${w * 0.57} ${h * 0.74}" stroke="#000" stroke-width="2"/>
      <path d="M${w * 0.92} ${h}L${w * 0.57} ${h * 0.74}" stroke="#000" stroke-width="2"/>
      <path d="M${w * 0.2} ${h}L${w * 0.58} ${h * 0.745}" stroke="#4d3e55" stroke-width="1" opacity=".5"/>
      <path d="M${w * 0.8} ${h}L${w * 0.58} ${h * 0.745}" stroke="#4d3e55" stroke-width="1" opacity=".5"/>
    </g>
    <g transform="translate(${w * 0.28} ${h * 0.585})" fill="#0a0912">
      <ellipse cx="${w * 0.18}" cy="${h * 0.19}" rx="${w * 0.24}" ry="${h * 0.026}" fill="#ffbd74" opacity=".09" filter="url(#${id}-blur24)"/>
      <path d="M${w * 0.335} ${h * 0.062}L${w * 0.45} ${h * 0.105}L${w * 0.335} ${h * 0.088}Z" fill="#ffe1a4" opacity=".14" filter="url(#${id}-blur24)"/>
      <rect x="0" y="0" width="${w * 0.36}" height="${h * 0.115}" rx="${w * 0.03}"/>
      <path d="M${w * 0.05} 0 q${w * 0.13} -${h * 0.035} ${w * 0.26} 0Z" opacity=".7"/>
      <rect x="${w * 0.045}" y="${h * 0.028}" width="${w * 0.27}" height="${h * 0.038}" rx="${w * 0.006}" fill="#ffd58a" opacity=".86"/>
      <g stroke="#a56f3e" stroke-width="1" opacity=".42">
        <path d="M${w * 0.075} ${h * 0.028}v${h * 0.038}M${w * 0.105} ${h * 0.028}v${h * 0.038}M${w * 0.135} ${h * 0.028}v${h * 0.038}M${w * 0.165} ${h * 0.028}v${h * 0.038}M${w * 0.195} ${h * 0.028}v${h * 0.038}M${w * 0.225} ${h * 0.028}v${h * 0.038}M${w * 0.255} ${h * 0.028}v${h * 0.038}M${w * 0.285} ${h * 0.028}v${h * 0.038}"/>
      </g>
      <rect x="${w * 0.045}" y="${h * 0.074}" width="${w * 0.27}" height="${h * 0.014}" rx="${w * 0.004}" fill="#f5b078" opacity=".35"/>
      <g fill="#b5744d" opacity=".5">
        <rect x="${w * 0.085}" y="${h * 0.075}" width="${w * 0.022}" height="${h * 0.009}" rx="1"/>
        <rect x="${w * 0.142}" y="${h * 0.075}" width="${w * 0.012}" height="${h * 0.009}" rx="1"/>
        <rect x="${w * 0.255}" y="${h * 0.075}" width="${w * 0.034}" height="${h * 0.009}" rx="1"/>
      </g>
      <circle cx="${w * 0.335}" cy="${h * 0.062}" r="${w * 0.008}" fill="#fff4d0" filter="url(#${id}-softglow)"/>
      <rect x="${w * 0.008}" y="${h * 0.102}" width="${w * 0.344}" height="${h * 0.026}" rx="${w * 0.006}"/>
      <path d="M${w * 0.06} ${h * 0.128}v${h * 0.018}M${w * 0.3} ${h * 0.128}v${h * 0.018}" stroke="#0a0912" stroke-width="${w * 0.012}"/>
      <g fill="#121019" stroke="#443247" stroke-width="1.2">
        <circle cx="${w * 0.078}" cy="${h * 0.15}" r="${w * 0.014}"/>
        <circle cx="${w * 0.19}" cy="${h * 0.15}" r="${w * 0.014}"/>
        <circle cx="${w * 0.282}" cy="${h * 0.15}" r="${w * 0.014}"/>
      </g>
      <g fill="#77606f" opacity=".55">
        <circle cx="${w * 0.078}" cy="${h * 0.15}" r="${w * 0.004}"/>
        <circle cx="${w * 0.19}" cy="${h * 0.15}" r="${w * 0.004}"/>
        <circle cx="${w * 0.282}" cy="${h * 0.15}" r="${w * 0.004}"/>
      </g>
      <path d="M${w * 0.115} 0V${-h * 0.035}M${w * 0.25} 0V${-h * 0.035}M${w * 0.115} ${-h * 0.035}H${w * 0.25}M${w * 0.155} ${-h * 0.035}L${w * 0.19} ${-h * 0.07}L${w * 0.225} ${-h * 0.035}" stroke="#0a0912" stroke-width="2" fill="none"/>
    </g>
    <g opacity=".5" stroke="#392b40" stroke-width="1">
      ${Array.from({ length: 9 }, (_, i) => {
        const y = h * (0.76 + i * 0.022);
        const spread = w * (0.16 + i * 0.045);
        return `<path d="M${n(w * 0.57 - spread)} ${n(y)}H${n(w * 0.57 + spread)}"/>`;
      }).join('')}
    </g>
    <g stroke="#0b0a13" fill="none" opacity=".9">
      <path d="M${w * 0.93} ${h * 0.74}V${h * 0.42}" stroke-width="${w * 0.008}"/>
      <path d="M${w * 0.86} ${h * 0.46}h${w * 0.14}" stroke-width="${w * 0.005}"/>
      <path d="M${w * 0.88} ${h * 0.49}h${w * 0.1}" stroke-width="${w * 0.004}"/>
      <path d="M${w * 0.78} 0 Q${w * 0.86} ${h * 0.2} ${w * 0.86} ${h * 0.46}M${w * 0.66} 0 Q${w * 0.79} ${h * 0.22} ${w * 0.87} ${h * 0.46}" stroke-width="1.3" opacity=".6"/>
    </g>
    ${variant === 0 ? `<g fill="#fff1d4" opacity=".8" filter="url(#${id}-softglow)">
      <circle cx="${w * 0.46}" cy="${h * 0.38}" r="2.4"/><circle cx="${w * 0.52}" cy="${h * 0.3}" r="1.5"/>
      <circle cx="${w * 0.32}" cy="${h * 0.32}" r="1.7"/></g>` : ''}
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".6"/>
  </g>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '星屑電車 · STARDUST TRAM', 'CXN ARCHIVE / 001')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 02 · 夏日的最后一帧                                                  */
/* ------------------------------------------------------------------ */
function summerFrame(w, h, id, variant = 0) {
  const rng = rngFrom(221 + variant * 19);
  const sky = variant === 1
    ? ['#141d35', '#3e4d78', '#b2747e', '#f3b08f', '#f6d9ba']
    : ['#f8e7c6', '#f9c996', '#f6a077', '#e8786d', '#a8526d'];
  const sunX = w * 0.72;
  const sunY = h * 0.46;
  const body = `
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      ${sky.map((c, i) => `<stop offset="${i / (sky.length - 1)}" stop-color="${c}"/>`).join('')}
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
    ${stars(rng, w, h, variant === 1 ? 110 : 20, h * 0.4)}
    <circle cx="${sunX}" cy="${sunY}" r="${w * 0.2}" fill="#fff3d6" opacity=".8" filter="url(#${id}-blur60)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${w * 0.085}" fill="#fff8e8" opacity=".95"/>
    ${cloud(rng, w * 0.2, h * 0.3, w * 0.35, '#fff4dd', 0.5, 24)}
    ${cloud(rng, w * 0.68, h * 0.25, w * 0.4, '#ffe9d0', 0.38, 60)}
    ${cloud(rng, w * 0.5, h * 0.5, w * 0.8, '#f2b394', 0.3, 24)}
    <linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${variant === 1 ? '#1e2b45' : '#7a4b5f'}"/>
      <stop offset="1" stop-color="${variant === 1 ? '#070b16' : '#2f1d35'}"/>
    </linearGradient>
    <path d="M0 ${h * 0.57}H${w}V${h}H0Z" fill="url(#${id}-sea)"/>
    <path d="M0 ${h * 0.57}H${w}" stroke="#ffe7c0" stroke-opacity=".55"/>
    <g stroke="#ffe3b4" stroke-width="1.4" opacity=".55">
      ${Array.from({ length: 30 }, () => {
        const y = h * (0.6 + rng() * 0.3);
        const x = w * (0.28 + rng() * 0.48);
        const len = w * (0.015 + rng() * 0.07);
        return `<path d="M${n(x)} ${n(y)}h${n(len)}" opacity="${n(0.25 + rng() * 0.6)}"/>`;
      }).join('')}
    </g>
    <path d="M${w * 0.57} ${h * 0.57} Q${w * 0.68} ${h * 0.55} ${w * 0.8} ${h * 0.57}" stroke="#fff3d6" stroke-width="2" opacity=".7" fill="none"/>
    <g stroke="#1b1620" fill="none">
      <path d="M${w * 0.86} ${h * 0.83}V${h * 0.3}" stroke-width="${w * 0.007}"/>
      <path d="M${w * 0.79} ${h * 0.35}h${w * 0.14}M${w * 0.81} ${h * 0.39}h${w * 0.1}M${w * 0.83} ${h * 0.43}h${w * 0.06}" stroke-width="${w * 0.004}"/>
      <path d="M${w * 0.5} 0 Q${w * 0.68} ${h * 0.15} ${w * 0.855} ${h * 0.35}M${w * 0.3} 0 Q${w * 0.6} ${h * 0.14} ${w * 0.855} ${h * 0.35}" stroke-width="1.2" opacity=".42"/>
    </g>
    <g fill="none" stroke="#241b22" stroke-width="2" opacity=".75">
      <path d="M${w * 0.22} ${h * 0.24}q8 -7 16 0q8 -7 16 0"/>
      <path d="M${w * 0.31} ${h * 0.2}q5 -5 10 0q5 -5 10 0"/>
    </g>
    <path d="M0 ${h * 0.815} Q${w * 0.32} ${h * 0.79} ${w * 0.56} ${h * 0.83} T${w} ${h * 0.8}V${h}H0Z" fill="#100d15" opacity=".88"/>
    <g stroke="#efe2cd" stroke-opacity=".38" fill="none" stroke-width="1">
      <rect x="24" y="24" width="${w - 48}" height="${h - 48}"/>
      <path d="M24 ${h * 0.18}h18M24 ${h * 0.82}h18M${w - 42} ${h * 0.18}h18M${w - 42} ${h * 0.82}h18" opacity=".65"/>
    </g>
    <g fill="#efe2cd" opacity=".55" font-family="Inter, ui-sans-serif, sans-serif" font-size="10" letter-spacing="2.4">
      <text x="48" y="${h * 0.155}">FRAME 24 / 24</text>
      <text x="48" y="${h * 0.87}">${variant === 1 ? '19:47 · ISO 400' : '18:02 · ISO 100'}</text>
      <text x="${w - 48}" y="${h * 0.87}" text-anchor="end">FUJIFILM 400H</text>
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".4"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '夏の最後のフレーム', 'CXN ARCHIVE / 002', '#f4e7d5', 'right')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 03 · 月面茶会                                                        */
/* ------------------------------------------------------------------ */
function moonTea(w, h, id, variant = 0) {
  const rng = rngFrom(733 + variant * 29);
  const x = w * 0.52;
  const y = h * (variant === 1 ? 0.3 : 0.36);
  const r = w * (variant === 1 ? 0.42 : 0.34);
  const body = `
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#050a17"/><stop offset=".55" stop-color="#0e1930"/>
      <stop offset="1" stop-color="#1d2a45"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
    ${stars(rng, w, h, 220, h * 0.8)}
    <circle cx="${x}" cy="${y}" r="${r * 1.5}" fill="#b9d4ff" opacity=".09" filter="url(#${id}-blur60)"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="#f3e8cf"/>
    <g fill="#c9bfab" opacity=".42">
      <circle cx="${x - r * 0.36}" cy="${y - r * 0.16}" r="${r * 0.11}"/>
      <circle cx="${x + r * 0.3}" cy="${y + r * 0.25}" r="${r * 0.08}"/>
      <circle cx="${x + r * 0.04}" cy="${y - r * 0.4}" r="${r * 0.05}"/>
      <circle cx="${x - r * 0.2}" cy="${y + r * 0.46}" r="${r * 0.06}"/>
      <circle cx="${x + r * 0.55}" cy="${y - r * 0.12}" r="${r * 0.035}"/>
    </g>
    <circle cx="${x}" cy="${y}" r="${r * 1.02}" fill="none" stroke="#f3e8cf" stroke-opacity=".18"/>
    ${cloud(rng, w * 0.3, h * 0.45, w * 0.7, '#8097bd', 0.2, 60)}
    <g transform="translate(${w * 0.5} ${h * 0.85})">
      <ellipse cx="0" cy="0" rx="${w * 0.34}" ry="${h * 0.035}" fill="#05070e" opacity=".9"/>
      <rect x="${-w * 0.2}" y="${-h * 0.02}" width="${w * 0.4}" height="${h * 0.018}" fill="#080c15"/>
      <path d="M${-w * 0.13} ${-h * 0.02}l${w * 0.02} ${-h * 0.15}h${w * 0.06}l${w * 0.02} ${h * 0.15}Z" fill="#070a11"/>
      <path d="M${-w * 0.095} ${-h * 0.17}h${w * 0.02}v${-h * 0.018}" stroke="#070a11" stroke-width="${w * 0.008}" fill="none"/>
      <path d="M${-w * 0.085} ${-h * 0.17}q${w * 0.02} ${-h * 0.04} ${w * 0.04} 0" stroke="#070a11" stroke-width="${w * 0.007}" fill="none"/>
      <g fill="#070a11">
        <path d="M${w * 0.025} ${-h * 0.02}l${w * 0.008} ${-h * 0.055}h${w * 0.036}l${w * 0.008} ${h * 0.055}Z"/>
        <path d="M${w * 0.078} ${-h * 0.02}l${w * 0.008} ${-h * 0.055}h${w * 0.036}l${w * 0.008} ${h * 0.055}Z"/>
        <ellipse cx="${w * 0.051}" cy="${-h * 0.075}" rx="${w * 0.028}" ry="${h * 0.005}" opacity=".6"/>
        <ellipse cx="${w * 0.104}" cy="${-h * 0.075}" rx="${w * 0.028}" ry="${h * 0.005}" opacity=".6"/>
      </g>
      <circle cx="${w * 0.05}" cy="${-h * 0.1}" r="${w * 0.028}" fill="#ffcf8b" opacity=".15" filter="url(#${id}-blur24)"/>
      <path d="M${-w * 0.03} ${-h * 0.055}q${w * 0.009} ${-h * 0.018} ${w * 0.018} 0M${-w * 0.044} ${-h * 0.092}q${w * 0.006} ${-h * 0.013} ${w * 0.012} 0" stroke="#cbd8eb" stroke-opacity=".3" fill="none" stroke-width="1.2"/>
    </g>
    <g fill="#f4dfe0" opacity=".75">
      ${Array.from({ length: 22 }, () => {
        const px = rng() * w, py = h * (0.5 + rng() * 0.5);
        const s = 2 + rng() * 5;
        return `<path d="M${n(px)} ${n(py)}q${n(s)} ${n(-s * 0.8)} ${n(s * 1.7)} ${n(s * 0.4)}q${n(-s * 0.8)} ${n(s * 0.6)} ${n(-s * 1.7)} ${n(-s * 0.4)}Z" transform="rotate(${n(rng() * 360)} ${n(px)} ${n(py)})"/>`;
      }).join('')}
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".35"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '月面茶会 · TEA ON THE MOON', 'CXN ARCHIVE / 003')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 04 · 深海邮局                                                        */
/* ------------------------------------------------------------------ */
function deepSea(w, h, id, variant = 0) {
  const rng = rngFrom(455 + variant * 41);
  const body = `
    <linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#062e3c"/><stop offset=".5" stop-color="#041a2b"/>
      <stop offset="1" stop-color="#020910"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-sea)"/>
    <g opacity=".2" fill="#9de6df" filter="url(#${id}-blur24)">
      <path d="M${w * 0.14} 0L${w * 0.38} ${h * 0.8}L${w * 0.55} ${h * 0.8}L${w * 0.3} 0Z"/>
      <path d="M${w * 0.48} 0L${w * 0.63} ${h}L${w * 0.73} ${h}L${w * 0.6} 0Z" opacity=".6"/>
      <path d="M${w * 0.73} 0L${w * 0.76} ${h * 0.75}L${w * 0.86} ${h * 0.75}L${w * 0.86} 0Z" opacity=".4"/>
    </g>
    <path d="M0 ${h * 0.65} Q${w * 0.3} ${h * 0.6} ${w * 0.6} ${h * 0.66} T${w} ${h * 0.63}V${h}H0Z" fill="#020a10"/>
    <g transform="translate(${w * (variant === 1 ? 0.38 : 0.56)} ${h * (variant === 1 ? 0.54 : 0.42)}) scale(${variant === 1 ? 1.7 : 1})" opacity=".9">
      <path d="M0 0q-42 18-12 52q28 34-8 66q-30 30 6 58" fill="none" stroke="#ff8fa4" stroke-width="3" opacity=".7"/>
      <path d="M20 2q30 22 6 48q-24 30 10 56q20 18 2 44" fill="none" stroke="#ffc1c6" stroke-width="2" opacity=".5"/>
      <path d="M-22 4q-34 24-8 50q30 28-6 60" fill="none" stroke="#e3779c" stroke-width="2" opacity=".45"/>
      <path d="M-48 0a48 38 0 1 0 96 0a48 38 0 1 0-96 0" fill="#f2a9b6" opacity=".22"/>
      <path d="M-48 0a48 38 0 1 0 96 0a48 38 0 1 0-96 0" fill="none" stroke="#ffb3be" stroke-width="1.3" opacity=".7"/>
      <path d="M-30 -10a30 24 0 0 1 60 0" fill="#ffd4cb" opacity=".2"/>
    </g>
    <g transform="translate(${w * 0.76} ${h * 0.22})" opacity=".34">
      <path d="M0 0q60 20 120 0q-20 55-60 62q-40-7-60-62Z" fill="#9bcdd1"/>
      <path d="M120 0q40 -10 72 14q-20 10-72 -14Z" fill="#9bcdd1"/>
      <circle cx="28" cy="28" r="2" fill="#ffeddb"/>
    </g>
    <g transform="translate(${w * 0.35} ${h * 0.83})">
      <rect x="-24" y="-98" width="48" height="90" rx="5" fill="#0b1319" stroke="#8ab8b5" stroke-opacity=".35"/>
      <path d="M-24 -62h48" stroke="#8ab8b5" stroke-opacity=".25"/>
      <rect x="-8" y="-80" width="16" height="13" rx="1.5" fill="#ffbe85" opacity=".85"/>
      <path d="M-30 -98q30 -22 60 0" fill="none" stroke="#23343a" stroke-width="4"/>
      <rect x="-5" y="-8" width="10" height="28" fill="#081015"/>
      <circle cx="24" cy="-88" r="5" fill="#ffce95" filter="url(#${id}-softglow)"/>
      <path d="M24 -82v8" stroke="#ffce95" opacity=".4"/>
    </g>
    <path d="M0 ${h * 0.88} Q${w * 0.16} ${h * 0.84} ${w * 0.32} ${h * 0.9} T${w * 0.7} ${h * 0.87} T${w} ${h * 0.9}V${h}H0Z" fill="#010407"/>
    <g fill="#ffd7c8" opacity=".5">
      ${Array.from({ length: 34 }, () => {
        const px = rng() * w, py = rng() * h, s = 0.8 + rng() * 2.8;
        return `<circle cx="${n(px)}" cy="${n(py)}" r="${n(s)}" opacity="${n(0.25 + rng() * 0.55)}"/>`;
      }).join('')}
    </g>
    <g stroke="#b6e5df" stroke-opacity=".18" fill="none">
      <circle cx="${w * 0.82}" cy="${h * 0.7}" r="${w * 0.032}"/>
      <circle cx="${w * 0.79}" cy="${h * 0.58}" r="${w * 0.014}"/>
      <circle cx="${w * 0.9}" cy="${h * 0.45}" r="${w * 0.008}"/>
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".3"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '深海郵便局 · POST OFFICE', 'CXN ARCHIVE / 004', '#d8ece8')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 05 · 纸月亮观测站                                                    */
/* ------------------------------------------------------------------ */
function paperMoon(w, h, id, variant = 0) {
  const rng = rngFrom(908 + variant * 31);
  const body = `
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8e0cd"/><stop offset=".52" stop-color="#d8c9b4"/>
      <stop offset="1" stop-color="#9b8b7d"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
    <circle cx="${w * 0.62}" cy="${h * 0.32}" r="${w * 0.3}" fill="#c8594f"/>
    <circle cx="${w * 0.62}" cy="${h * 0.32}" r="${w * 0.3}" fill="none" stroke="#f7ead4" stroke-width="1.2" opacity=".6"/>
    <circle cx="${w * 0.62}" cy="${h * 0.32}" r="${w * 0.26}" fill="none" stroke="#f7ead4" stroke-width=".7" opacity=".35" stroke-dasharray="2 8"/>
    ${cloud(rng, w * 0.35, h * 0.25, w * 0.6, '#f3e9d7', 0.35, 60)}
    ${cloud(rng, w * 0.75, h * 0.48, w * 0.5, '#eadbc8', 0.3, 24)}
    ${stars(rng, w, h, 55, h * 0.35, '#6c5b52')}
    <path d="M0 ${h * 0.63} Q${w * 0.2} ${h * 0.55} ${w * 0.42} ${h * 0.64} T${w * 0.84} ${h * 0.61} T${w} ${h * 0.65}V${h}H0Z" fill="#3e3733"/>
    <path d="M0 ${h * 0.72} Q${w * 0.25} ${h * 0.63} ${w * 0.54} ${h * 0.73} T${w} ${h * 0.7}V${h}H0Z" fill="#252221"/>
    <path d="M0 ${h * 0.85} Q${w * 0.3} ${h * 0.76} ${w * 0.64} ${h * 0.86} T${w} ${h * 0.83}V${h}H0Z" fill="#131111"/>
    <g transform="translate(${w * 0.32} ${h * 0.585})" fill="#121111">
      <rect x="-20" y="0" width="40" height="${h * 0.14}"/>
      <path d="M-46 0a46 40 0 0 1 92 0Z"/>
      <path d="M0 -40V-58M-16 -58H16" stroke="#121111" stroke-width="3"/>
      <rect x="-76" y="${h * 0.05}" width="32" height="${h * 0.09}"/>
      <path d="M-72 ${h * 0.05}l12 -18l12 18Z" fill="#121111"/>
      <rect x="-12" y="${h * 0.045}" width="24" height="6" fill="#ffce8a" opacity=".9"/>
      <circle cx="0" cy="${h * 0.12}" r="6" fill="#ffce8a" opacity=".9"/>
      <circle cx="-60" cy="${h * 0.085}" r="3" fill="#ffce8a" opacity=".65"/>
    </g>
    <g stroke="#171415" fill="none" opacity=".8">
      <path d="M${w * 0.18} ${h * 0.83}V${h * 0.63}M${w * 0.13} ${h * 0.66}l${w * 0.1} ${-h * 0.06}M${w * 0.13} ${h * 0.6}l${w * 0.1} ${h * 0.06}" stroke-width="2"/>
      <path d="M${w * 0.84} ${h * 0.89}V${h * 0.78}" stroke-width="1.4"/>
    </g>
    <g fill="#171415" opacity=".8">
      <path d="M${w * 0.7} ${h * 0.26}q10 -8 20 0q10 -8 20 0" fill="none" stroke="#171415" stroke-width="2"/>
      <path d="M${w * 0.76} ${h * 0.21}q6 -5 12 0q6 -5 12 0" fill="none" stroke="#171415" stroke-width="1.5"/>
    </g>
    <g fill="#f5e7d2" opacity=".8">
      ${Array.from({ length: 20 }, () => {
        const px = rng() * w, py = h * (0.15 + rng() * 0.5), s = 2 + rng() * 6;
        return `<path d="M${n(px)} ${n(py)}l${n(s)} ${n(s * 0.4)}l${n(-s * 0.4)} ${n(s)}l${n(-s * 0.6)} ${n(-s * 1.4)}Z" opacity="${n(0.15 + rng() * 0.4)}"/>`;
      }).join('')}
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".35"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '紙月天文台 · PAPER MOON', 'CXN ARCHIVE / 005', '#f0e4d2')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 06 · 在世界尽头交换心跳 (novel)                                      */
/* ------------------------------------------------------------------ */
function heartbeat(w, h, id, variant = 0) {
  const rng = rngFrom(1266 + variant * 17);
  const cx = w * 0.5;
  const cy = h * (variant === 1 ? 0.42 : 0.46);
  const r = w * (variant === 1 ? 0.42 : 0.3);
  const body = `
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#160d1a"/><stop offset=".5" stop-color="#371526"/>
      <stop offset="1" stop-color="#0c0a12"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-bg)"/>
    ${stars(rng, w, h, 80, h * 0.8, '#ffd9cf')}
    <circle cx="${cx}" cy="${cy}" r="${r * 1.9}" fill="#ff5f7d" opacity=".08" filter="url(#${id}-blur60)"/>
    <g transform="translate(${cx} ${cy})">
      <circle cx="${-r * 0.3}" cy="0" r="${r}" fill="#ff8a91" opacity=".5"/>
      <circle cx="${r * 0.3}" cy="0" r="${r}" fill="#b44b72" opacity=".45"/>
      <circle cx="${-r * 0.3}" cy="0" r="${r}" fill="none" stroke="#ffd6c7" stroke-opacity=".45"/>
      <circle cx="${r * 0.3}" cy="0" r="${r}" fill="none" stroke="#ffd6c7" stroke-opacity=".3"/>
      <path d="M${-r * 2.2} 0A${r * 2.2} ${r * 0.5} 0 1 0 ${r * 2.2} 0" fill="none" stroke="#f1c2bb" stroke-opacity=".25" stroke-dasharray="3 9"/>
      <path d="M${-r * 2.2} 0H${-r * 0.95}l${r * 0.2} ${-r * 0.38}l${r * 0.28} ${r * 0.75}l${r * 0.22} ${-r * 0.5}l${r * 0.16} ${r * 0.13}H${r * 2.2}" fill="none" stroke="#ffe4d6" stroke-width="2.4" opacity=".88" stroke-linejoin="round"/>
    </g>
    <g fill="#ffc9c7" opacity=".7">
      ${Array.from({ length: 26 }, () => {
        const px = rng() * w, py = rng() * h, s = 2 + rng() * 7;
        return `<path d="M${n(px)} ${n(py)}q${n(s)} ${n(-s * 0.8)} ${n(s * 1.7)} ${n(s * 0.4)}q${n(-s * 0.8)} ${n(s * 0.6)} ${n(-s * 1.7)} ${n(-s * 0.4)}Z" opacity="${n(0.15 + rng() * 0.5)}" transform="rotate(${n(rng() * 360)} ${n(px)} ${n(py)})"/>`;
      }).join('')}
    </g>
    <g opacity=".5" fill="#f6e4d4" font-family="'Noto Serif CJK SC', serif" font-size="${variant === 1 ? 18 : 14}" letter-spacing="8">
      <text x="${w * 0.08}" y="${h * 0.1}" writing-mode="tb">世界の果てで、鼓動を交換した</text>
    </g>
    <g opacity=".35" stroke="#f6e4d4" fill="none">
      <rect x="28" y="28" width="${w - 56}" height="${h - 56}"/>
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".3"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '世界の果てで、鼓動を交換した', 'NOVEL / CXN ARCHIVE 006', '#f6e4d4', 'right')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 07 · 雾中列车 (novel)                                                */
/* ------------------------------------------------------------------ */
function mistTrain(w, h, id, variant = 0) {
  const rng = rngFrom(871 + variant * 23);
  const body = `
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9cec4"/><stop offset=".5" stop-color="#9fa89e"/>
      <stop offset="1" stop-color="#59625d"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>
    <circle cx="${w * 0.58}" cy="${h * 0.34}" r="${w * 0.2}" fill="#eef0e2" opacity=".5" filter="url(#${id}-blur60)"/>
    <g fill="#464f4b" opacity=".72">
      ${Array.from({ length: 26 }, () => {
        const x = rng() * w;
        const base = h * (0.52 + rng() * 0.18);
        const th = h * (0.12 + rng() * 0.22);
        const tw = th * (0.2 + rng() * 0.12);
        return `<path d="M${n(x)} ${n(base)}L${n(x)} ${n(base - th * 0.4)}L${n(x - tw)} ${n(base - th * 0.2)}L${n(x - tw * 0.7)} ${n(base - th * 0.55)}L${n(x)} ${n(base - th)}L${n(x + tw * 0.7)} ${n(base - th * 0.55)}L${n(x + tw)} ${n(base - th * 0.2)}Z" opacity="${n(0.2 + rng() * 0.6)}"/>`;
      }).join('')}
    </g>
    <g fill="#758079" opacity=".6" filter="url(#${id}-blur24)">
      <ellipse cx="${w * 0.4}" cy="${h * 0.56}" rx="${w * 0.7}" ry="${h * 0.1}"/>
      <ellipse cx="${w * 0.7}" cy="${h * 0.66}" rx="${w * 0.8}" ry="${h * 0.08}"/>
    </g>
    <path d="M0 ${h * 0.72} Q${w * 0.3} ${h * 0.68} ${w * 0.6} ${h * 0.73} T${w} ${h * 0.71}V${h}H0Z" fill="#323a36"/>
    <path d="M${w * 0.12} ${h}L${w * 0.52} ${h * 0.73}M${w * 0.92} ${h}L${w * 0.52} ${h * 0.73}" stroke="#202724" stroke-width="4"/>
    <g transform="translate(${w * 0.5} ${h * 0.7})">
      <rect x="${-w * 0.2}" y="${-h * 0.12}" width="${w * 0.4}" height="${h * 0.16}" rx="${w * 0.02}" fill="#1f2825"/>
      <rect x="${-w * 0.165}" y="${-h * 0.095}" width="${w * 0.11}" height="${h * 0.04}" rx="3" fill="#d9ddc7" opacity=".75"/>
      <rect x="${w * 0.055}" y="${-h * 0.095}" width="${w * 0.11}" height="${h * 0.04}" rx="3" fill="#d9ddc7" opacity=".6"/>
      <circle cx="${-w * 0.145}" cy="${h * 0.012}" r="${w * 0.011}" fill="#fff4c8" filter="url(#${id}-softglow)"/>
      <circle cx="${-w * 0.145}" cy="${h * 0.012}" r="${w * 0.035}" fill="#fff4c8" opacity=".12" filter="url(#${id}-blur24)"/>
      <path d="M${-w * 0.2} ${h * 0.04}h${w * 0.4}" stroke="#0e1311" stroke-width="3"/>
    </g>
    <g fill="#d5dac9" opacity=".5" filter="url(#${id}-blur24)">
      <ellipse cx="${w * 0.3}" cy="${h * 0.76}" rx="${w * 0.45}" ry="${h * 0.04}"/>
      <ellipse cx="${w * 0.72}" cy="${h * 0.84}" rx="${w * 0.4}" ry="${h * 0.05}"/>
      <ellipse cx="${w * 0.5}" cy="${h * 0.62}" rx="${w * 0.5}" ry="${h * 0.03}"/>
    </g>
    <g stroke="#dee2d4" stroke-opacity=".28" fill="none">
      ${Array.from({ length: 20 }, () => {
        const x = rng() * w; const y = h * (0.4 + rng() * 0.5);
        return `<path d="M${n(x)} ${n(y)}h${n(20 + rng() * 80)}"/>`;
      }).join('')}
    </g>
    <g opacity=".5" fill="#eef0e2" font-family="'Noto Serif CJK SC', serif" font-size="15" letter-spacing="7">
      <text x="${w * 0.86}" y="${h * 0.12}" writing-mode="tb">霧の中の列車</text>
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".45"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '霧の中の列車 · TRAIN IN THE MIST', 'NOVEL / CXN ARCHIVE 007', '#e8ebdf')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 08 · 跨次元放映室 (video)                                            */
/* ------------------------------------------------------------------ */
function screening(w, h, id, variant = 0) {
  const rng = rngFrom(320 + variant * 53);
  const body = `
    <linearGradient id="${id}-room" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0709"/><stop offset=".65" stop-color="#140b0e"/>
      <stop offset="1" stop-color="#050304"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-room)"/>
    <g transform="translate(${w * 0.5} ${h * 0.44})">
      <rect x="${-w * 0.27}" y="${-h * 0.2}" width="${w * 0.54}" height="${h * 0.4}" fill="#eee7d4" opacity=".93"/>
      <rect x="${-w * 0.27}" y="${-h * 0.2}" width="${w * 0.54}" height="${h * 0.4}" fill="none" stroke="#f8f1de" stroke-width="2"/>
      <circle cx="${w * 0.07}" cy="${-h * 0.035}" r="${w * 0.055}" fill="#e0a678" opacity=".4"/>
      <path d="M${-w * 0.2} ${h * 0.12} Q${-w * 0.05} ${h * 0.03} ${w * 0.12} ${h * 0.13} T${w * 0.24} ${h * 0.09}V${h * 0.2}H${-w * 0.2}Z" fill="#2c2430" opacity=".75"/>
      <path d="M${-w * 0.2} ${h * 0.12} Q${-w * 0.05} ${h * 0.06} ${w * 0.12} ${h * 0.14}" fill="none" stroke="#f0d2b0" stroke-opacity=".35" stroke-width="1"/>
      <path d="M${-w * 0.18} ${-h * 0.06}H${w * 0.17}" stroke="#7a6e6c" stroke-opacity=".3"/>
    </g>
    <g opacity=".3" filter="url(#${id}-blur24)">
      <path d="M${w * 0.77} ${h * 0.78}L${w * 0.4} ${h * 0.3}H${w * 0.6}L${w * 0.93} ${h * 0.78}Z" fill="#ffe8c4"/>
    </g>
    <g opacity=".14" fill="#ffe0b8">
      <path d="M${w * 0.78} ${h * 0.8}L${w * 0.218} ${h * 0.24}H${w * 0.252}L${w * 0.83} ${h * 0.8}Z"/>
    </g>
    <g fill="#050304">
      ${Array.from({ length: 17 }, (_, i) => {
        const x = w * 0.06 + i * w * 0.055;
        const y = h * (0.79 + (i % 2) * 0.015);
        return `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${w * 0.028}" ry="${h * 0.05}"/>`;
      }).join('')}
      <path d="M0 ${h * 0.82}Q${w * 0.5} ${h * 0.76} ${w} ${h * 0.83}V${h}H0Z"/>
    </g>
    <g fill="#ffe6ba" opacity=".55">
      ${Array.from({ length: 55 }, () => {
        const x = rng() * w * 0.65 + w * 0.05, y = rng() * h * 0.65;
        return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(0.6 + rng() * 1.4)}" opacity="${n(0.1 + rng() * 0.6)}"/>`;
      }).join('')}
    </g>
    <g opacity=".65">
      <circle cx="${w * 0.88}" cy="${h * 0.15}" r="${w * 0.01}" fill="#ff6a7d"/>
      <text x="${w * 0.92}" y="${h * 0.157}" fill="#e9d9c9" font-family="Inter, sans-serif" font-size="${w * 0.012}" letter-spacing="3">REC</text>
      <circle cx="${w * 0.88}" cy="${h * 0.15}" r="${w * 0.017}" fill="none" stroke="#ff6a7d" stroke-width=".8" opacity=".5"/>
    </g>
    <g stroke="#e6d7c7" stroke-opacity=".2" fill="none">
      <rect x="${w * 0.04}" y="${h * 0.06}" width="${w * 0.92}" height="${h * 0.88}"/>
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".25"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '跨次元放映室 · SCREENING ROOM', 'FILM / CXN ARCHIVE 008', '#e9d9c9')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* 09 · 星轨 PV                                                        */
/* ------------------------------------------------------------------ */
function novaPV(w, h, id, variant = 0) {
  const rng = rngFrom(777 + variant * 43);
  const cx = w * 0.5, cy = h * 0.48;
  const body = `
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#06101c"/><stop offset=".45" stop-color="#0d2c3b"/>
      <stop offset=".72" stop-color="#3d2448"/><stop offset="1" stop-color="#120c1a"/>
    </linearGradient>
    <rect width="${w}" height="${h}" fill="url(#${id}-bg)"/>
    <circle cx="${cx}" cy="${cy}" r="${w * 0.32}" fill="#ff7290" opacity=".12" filter="url(#${id}-blur60)"/>
    <circle cx="${w * 0.72}" cy="${h * 0.35}" r="${w * 0.18}" fill="#61d4d2" opacity=".1" filter="url(#${id}-blur60)"/>
    ${stars(rng, w, h, 180, h * 0.85)}
    <g transform="translate(${cx} ${cy})" fill="none">
      <ellipse rx="${w * 0.36}" ry="${h * 0.13}" stroke="#ffd9c9" stroke-opacity=".3" transform="rotate(-16)"/>
      <ellipse rx="${w * 0.26}" ry="${h * 0.34}" stroke="#9de6e0" stroke-opacity=".2" transform="rotate(34)"/>
      <ellipse rx="${w * 0.44}" ry="${h * 0.08}" stroke="#ffd9c9" stroke-opacity=".12" transform="rotate(8)"/>
      <circle r="${w * 0.07}" fill="#ffe8d5" opacity=".92"/>
      <circle r="${w * 0.1}" stroke="#ffe8d5" stroke-opacity=".28" stroke-dasharray="2 10"/>
      <g stroke="#ffe8d5" stroke-opacity=".35">
        ${Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return `<path d="M${n(Math.cos(a) * w * 0.085)} ${n(Math.sin(a) * w * 0.085)}L${n(Math.cos(a) * w * (0.13 + (i % 3) * 0.035))} ${n(Math.sin(a) * w * (0.13 + (i % 3) * 0.035))}" />`;
        }).join('')}
      </g>
    </g>
    <g opacity=".65">
      <polygon points="${w * 0.22},${h * 0.6} ${w * 0.36},${h * 0.44} ${w * 0.4},${h * 0.66}" fill="none" stroke="#7ddbd7" stroke-width="1"/>
      <polygon points="${w * 0.68},${h * 0.26} ${w * 0.8},${h * 0.18} ${w * 0.77},${h * 0.36}" fill="none" stroke="#ff9eb0" stroke-width="1"/>
      <circle cx="${w * 0.8}" cy="${h * 0.62}" r="${w * 0.012}" fill="#ffb0bc"/>
      <circle cx="${w * 0.17}" cy="${h * 0.29}" r="${w * 0.007}" fill="#8de3dd"/>
    </g>
    <g fill="none" stroke="#f2e8dc" opacity=".4" font-family="Inter, sans-serif">
      <text x="${w * 0.08}" y="${h * 0.9}" font-size="${w * 0.044}" letter-spacing="14">CROSS</text>
      <text x="${w * 0.08}" y="${h * 0.955}" font-size="${w * 0.044}" letter-spacing="14" opacity=".5">DIMENSION</text>
    </g>
    <g fill="#f4e6d8" opacity=".6" font-family="'Noto Serif CJK SC', serif" font-size="${w * 0.016}" letter-spacing="8">
      <text x="${w * 0.9}" y="${h * 0.12}" writing-mode="tb">私たちは、まだ見ぬ次元の向こうへ</text>
    </g>
    <g stroke="#f4e6d8" stroke-opacity=".16" fill="none">
      <path d="M0 ${h * 0.5}h${w}M${w * 0.5} 0v${h}"/>
    </g>
    <rect width="${w}" height="${h}" fill="url(#${id}-haze)" opacity=".2"/>`;
  return `${openingTag(w, h)}<defs>${commonDefs(id)}</defs>${body}${label(w, h, '星軌 · STAR TRAIL PV', 'MOTION / CXN ARCHIVE 009', '#f4e6d8', 'right')}${closeSvg(id, w, h)}`;
}

/* ------------------------------------------------------------------ */
/* Static constellation texture                                        */
/* ------------------------------------------------------------------ */
function starfieldTexture(w = 1800, h = 1100, seed = 2048) {
  const rng = rngFrom(seed);
  const colors = ['#f3eee3', '#ff93a6', '#8fded9', '#f3c79c'];
  const glowColors = ['#ff93a6', '#8fded9', '#f3eee3'];
  let defs = '';
  let glows = '';
  for (let i = 0; i < 4; i++) {
    const [r, g, b] = [
      [255, 147, 166],
      [143, 222, 217],
      [243, 238, 227],
    ][i % 3];
    defs += `<radialGradient id="sf-g${i}"><stop offset="0" stop-color="rgb(${r},${g},${b})" stop-opacity=".34"/><stop offset=".45" stop-color="rgb(${r},${g},${b})" stop-opacity=".08"/><stop offset="1" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/></radialGradient>`;
    glows += `<circle cx="${n(rng() * w)}" cy="${n(rng() * h)}" r="${n(36 + rng() * 90)}" fill="url(#sf-g${i})"/>`;
  }
  let stars = '';
  for (let i = 0; i < 300; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 0.4 + Math.pow(rng(), 2.3) * 2.1;
    const o = 0.08 + rng() * 0.62;
    const color = rng() < 0.72 ? colors[0] : colors[1 + Math.floor(rng() * 3) % 3];
    stars += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${color}" opacity="${n(o)}"/>`;
    if (rng() > 0.955) {
      stars += `<path d="M${n(x - 6)} ${n(y)}H${n(x + 6)}M${n(x)} ${n(y - 6)}V${n(y + 6)}" stroke="${color}" stroke-width=".55" opacity="${n(o * 0.5)}"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${glows}${stars}</svg>`;
}

const starfield = starfieldTexture();
await writeFile(path.join(outDir, 'starfield.svg'), starfield);

/* ------------------------------------------------------------------ */

const artworks = [
  { file: 'stardust-tram', w: 1200, h: 1500, draw: stardustTram, seed: 0, variants: [[undefined, 0], ['-detail', 1], ['-night', 2]] },
  { file: 'last-frame-of-summer', w: 1650, h: 1100, draw: summerFrame, seed: 0, variants: [[undefined, 0], ['-dusk', 1], ['-close', 0]] },
  { file: 'moonlit-tea-party', w: 1200, h: 1500, draw: moonTea, seed: 0, variants: [[undefined, 0], ['-close', 1], ['-night', 0]] },
  { file: 'deep-sea-post-office', w: 1650, h: 1100, draw: deepSea, seed: 0, variants: [[undefined, 0], ['-jelly', 1], ['-deep', 0]] },
  { file: 'paper-moon-observatory', w: 1200, h: 1500, draw: paperMoon, seed: 0, variants: [[undefined, 0], ['-close', 1], ['-dusk', 0]] },
  { file: 'heartbeat-at-worlds-end', w: 1200, h: 1800, draw: heartbeat, seed: 0, variants: [[undefined, 0], ['-int', 1]] },
  { file: 'train-in-the-mist', w: 1200, h: 1800, draw: mistTrain, seed: 0, variants: [[undefined, 0], ['-int', 1]] },
  { file: 'first-night-screening', w: 1920, h: 1080, draw: screening, seed: 0, variants: [[undefined, 0], ['-seat', 1], ['-beam', 0]] },
  { file: 'star-trail-pv', w: 1600, h: 1000, draw: novaPV, seed: 0, variants: [[undefined, 0], ['-orbit', 1], ['-burst', 0]] },
];

for (const art of artworks) {
  for (const [suffix, variant] of art.variants) {
    const id = `a${art.seed}${variant}`;
    const svg = art.draw(art.w, art.h, id, variant);
    await writeFile(path.join(outDir, `${art.file}${suffix || ''}.svg`), svg);
  }
}

console.log(`Generated ${artworks.reduce((sum, a) => sum + a.variants.length, 0)} SVG artworks + starfield texture in public/art`);
