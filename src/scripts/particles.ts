/**
 * Lightweight, dependency-free particle renderer.
 *
 * Performance notes:
 * - one shared rAF loop for every field on the page
 * - fields pause when off-screen or when the tab is hidden
 * - DPR is capped and particle counts scale with device capability
 * - pointer input is sampled through one passive listener and smoothed in rAF
 * - glow stars use pre-rendered sprites instead of per-frame blur/shadow cost
 */

type RGB = readonly [number, number, number];
type Variant = 'starfield' | 'dust';

interface StarParticle {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  twinkle: number;
  phase: number;
  color: number;
  vx: number;
  vy: number;
  glow: boolean;
}

interface Field {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  variant: Variant;
  accent: RGB;
  accentCss: string;
  sprites: HTMLCanvasElement[];
  dotColors: string[];
  width: number;
  height: number;
  dpr: number;
  density: number;
  visible: boolean;
  lowPower: boolean;
  frameInterval: number;
  reduced: boolean;
  lastRender: number;
  stars: StarParticle[];
  lineScratch: Float32Array;
}

const fields = new Set<Field>();
let rafId: number | null = null;
let lastTick = 0;
let targetX = 0;
let targetY = 0;
let smoothX = 0;
let smoothY = 0;
let started = false;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const TAU = Math.PI * 2;

const CREAM: RGB = [243, 238, 227];
const COOL: RGB = [143, 222, 217];
const WARM: RGB = [243, 199, 156];
const PINK: RGB = [255, 147, 166];

function parseHex(value: string, fallback: RGB): RGB {
  let hex = value.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function makeGlowSprite(color: RGB) {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const [r, g, b] = color;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(0.14, `rgba(${r}, ${g}, ${b}, .72)`);
  gradient.addColorStop(0.36, `rgba(${r}, ${g}, ${b}, .22)`);
  gradient.addColorStop(0.72, `rgba(${r}, ${g}, ${b}, .035)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function detectLowPower() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  return cores <= 4 || memory <= 4;
}

function createField(host: HTMLElement): Field | null {
  const canvas = host.querySelector<HTMLCanvasElement>('[data-particle-canvas]');
  const ctx = canvas?.getContext('2d', { alpha: true, desynchronized: true });
  if (!canvas || !ctx) return null;

  const variant = (host.dataset.variant as Variant) || 'dust';
  const density = Math.min(2, Math.max(0.2, Number.parseFloat(host.dataset.density || '1') || 1));
  const accentValue = getComputedStyle(host).getPropertyValue('--particle-accent');
  const accent = parseHex(accentValue || '#ff93a6', PINK);
  const palette: RGB[] =
    variant === 'starfield' ? [CREAM, accent, COOL, WARM] : [CREAM, accent, WARM];
  const lowPower = detectLowPower();
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const quality = lowPower ? 0.52 : coarse ? 0.7 : 1;
  const widthScale = Math.min(1.25, Math.max(0.58, window.innerWidth / 1440));
  const baseCount = variant === 'starfield' ? 104 : 46;
  const count = Math.max(16, Math.round(baseCount * density * quality * widthScale));

  const stars: StarParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    const isStarfield = variant === 'starfield';
    const colorRoll = Math.random();
    const color = isStarfield
      ? colorRoll < 0.33
        ? 0
        : colorRoll < 0.68
          ? 1
          : colorRoll < 0.87
            ? 2
            : 3
      : colorRoll < 0.36
        ? 0
        : colorRoll < 0.82
          ? 1
          : 2;

    stars.push({
      x: isStarfield ? Math.random() * 2.5 - 1.25 : Math.random(),
      y: isStarfield ? Math.random() * 2.1 - 1.05 : Math.random(),
      z: Math.random() * 2 - 1,
      size: isStarfield ? 0.42 + Math.pow(Math.random(), 2.15) * 2.35 : 0.45 + Math.random() * 1.55,
      alpha: isStarfield ? 0.15 + Math.random() * 0.62 : 0.1 + Math.random() * 0.42,
      twinkle: 0.4 + Math.random() * 1.8,
      phase: Math.random() * TAU,
      color,
      vx: (Math.random() - 0.5) * 0.9,
      vy: 0.25 + Math.random() * 0.7,
      glow:
        (isStarfield && Math.random() < 0.32) ||
        (!isStarfield && Math.random() < 0.18),
    });
  }

  return {
    host,
    canvas,
    ctx,
    variant,
    accent,
    accentCss: `${accent[0]}, ${accent[1]}, ${accent[2]}`,
    sprites: palette.map(makeGlowSprite),
    dotColors: palette.map(([r, g, b]) => `rgba(${r}, ${g}, ${b}, 1)`),
    width: 0,
    height: 0,
    dpr: 1,
    density,
    visible: false,
    lowPower,
    frameInterval: lowPower ? 1000 / 24 : 1000 / 30,
    reduced: reducedMotion.matches,
    lastRender: 0,
    stars,
    lineScratch: new Float32Array(count * 2),
  };
}

function resizeField(field: Field) {
  const rect = field.host.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width === field.width && height === field.height) return false;

  field.width = width;
  field.height = height;
  field.dpr = Math.min(window.devicePixelRatio || 1, field.lowPower ? 1.2 : 1.5);
  field.canvas.width = Math.round(width * field.dpr);
  field.canvas.height = Math.round(height * field.dpr);
  return true;
}

function renderStarfield(field: Field, time: number) {
  const { ctx, stars, width: w, height: h } = field;
  const px = smoothX;
  const py = smoothY;
  const rotY = time * 0.000027 + px * 0.17;
  const rotX = -0.075 + Math.sin(time * 0.000052) * 0.045 + py * 0.095;
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const centerX = w * 0.5;
  const centerY = h * 0.47;
  const spreadX = w * 0.6;
  const spreadY = h * 0.58;

  for (const star of stars) {
    const x1 = star.x * cosY + star.z * sinY;
    const z1 = -star.x * sinY + star.z * cosY;
    const y1 = star.y * cosX - z1 * sinX;
    const z2 = star.y * sinX + z1 * cosX;
    const perspective = 1.55 / (1.55 - z2 * 0.48);
    const sx = centerX + x1 * spreadX * perspective + px * 13 * (0.55 - z2 * 0.25);
    const sy = centerY + y1 * spreadY * perspective + py * 9 * (0.55 - z2 * 0.25);

    if (sx < -32 || sx > w + 32 || sy < -32 || sy > h + 32) continue;

    const twinkle = 0.65 + 0.35 * Math.sin(time * 0.0011 * star.twinkle + star.phase);
    const alpha = Math.max(
      0,
      Math.min(1, star.alpha * twinkle * (0.58 + z2 * 0.22 + 0.22)),
    );
    if (alpha < 0.018) continue;

    ctx.globalAlpha = alpha;
    if (star.glow) {
      const size = (star.size * 2.15 + 1.3) * perspective;
      ctx.drawImage(field.sprites[star.color], sx - size * 1.8, sy - size * 1.8, size * 3.6, size * 3.6);
    } else {
      const size = Math.max(1, (star.size * 0.8 + 0.45) * perspective);
      ctx.fillStyle = field.dotColors[star.color];
      ctx.fillRect(sx, sy, size, size);
    }
  }
}

function renderDust(field: Field, time: number, dt: number, withLines: boolean) {
  const { ctx, stars, width: w, height: h, lineScratch } = field;
  const px = smoothX;
  const py = smoothY;
  const stride = dt * 0.000018;

  for (let i = 0; i < stars.length; i += 1) {
    const star = stars[i];
    star.x += star.vx * stride;
    star.y -= star.vy * stride;
    if (star.x < -0.05) star.x = 1.05;
    if (star.x > 1.05) star.x = -0.05;
    if (star.y < -0.05) star.y = 1.05;
    if (star.y > 1.05) star.y = -0.05;

    const perspective = 0.72 + star.z * 0.42;
    const sx = star.x * w + px * 10 * (1 - star.z * 0.45);
    const sy = star.y * h + py * 7 * (1 - star.z * 0.45);
    lineScratch[i * 2] = sx;
    lineScratch[i * 2 + 1] = sy;

    const twinkle = 0.7 + 0.3 * Math.sin(time * 0.001 * star.twinkle + star.phase);
    const alpha = Math.max(0, Math.min(1, star.alpha * twinkle));
    ctx.globalAlpha = alpha;
    if (star.glow) {
      const size = (star.size + 0.55) * perspective * 2.8;
      ctx.drawImage(field.sprites[star.color], sx - size, sy - size, size * 2, size * 2);
    } else {
      const size = Math.max(1, (star.size * 0.62 + 0.35) * perspective);
      ctx.fillStyle = field.dotColors[star.color];
      ctx.fillRect(sx, sy, size, size);
    }
  }

  if (!withLines || stars.length < 2) return;

  // Sparse constellation lines provide depth without a costly O(n²) graph.
  const threshold = Math.min(w, h) * 0.13;
  const thresholdSq = threshold * threshold;
  let links = 0;
  ctx.strokeStyle = `rgba(${field.accentCss}, 1)`;
  ctx.lineWidth = 0.65;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  for (let i = 0; i < stars.length && links < 42; i += 1) {
    const ax = lineScratch[i * 2];
    const ay = lineScratch[i * 2 + 1];
    for (let j = i + 1; j < stars.length && links < 42; j += 1) {
      const bx = lineScratch[j * 2];
      const by = lineScratch[j * 2 + 1];
      const dx = bx - ax;
      const dy = by - ay;
      if (dx * dx + dy * dy < thresholdSq) {
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        links += 1;
      }
    }
  }
  ctx.stroke();
}

function renderField(field: Field, time: number, dt: number) {
  if (field.width < 2 || field.height < 2) return;
  const { ctx } = field;
  ctx.setTransform(field.dpr, 0, 0, field.dpr, 0, 0);
  ctx.clearRect(0, 0, field.width, field.height);
  ctx.globalCompositeOperation = 'lighter';

  if (field.variant === 'starfield') {
    renderStarfield(field, time);
  } else {
    renderDust(field, time, dt, true);
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function tick(now: number) {
  rafId = null;
  const dt = Math.min(50, lastTick ? now - lastTick : 16);
  lastTick = now;

  const ease = 1 - Math.exp(-dt / 150);
  smoothX += (targetX - smoothX) * ease;
  smoothY += (targetY - smoothY) * ease;

  let anyVisible = false;
  for (const field of fields) {
    if (!field.visible) continue;
    anyVisible = true;
    if (!field.reduced && now - field.lastRender < field.frameInterval) continue;
    field.lastRender = now;
    renderField(field, now, dt);
  }

  if (anyVisible && !document.hidden) {
    rafId = requestAnimationFrame(tick);
  }
}

function wake() {
  if (rafId !== null || document.hidden || reducedMotion.matches) return;
  lastTick = 0;
  rafId = requestAnimationFrame(tick);
}

function onPointerMove(event: PointerEvent) {
  targetX = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
  targetY = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
}

export function initParticleFields(signal: AbortSignal) {
  const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-particle-field]'));
  if (!hosts.length) return;

  const localFields: Field[] = [];
  const fieldMap = new Map<Element, Field>();

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const field = fieldMap.get(entry.target);
        if (!field) continue;
        field.visible = entry.isIntersecting;
        if (field.visible) wake();
      }
    },
    { rootMargin: '160px 0px', threshold: 0 },
  );

  const resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          for (const entry of entries) {
            const field = fieldMap.get(entry.target);
            if (!field) continue;
            if (resizeField(field)) {
              if (field.reduced) renderField(field, performance.now(), 0);
              else wake();
            }
          }
        })
      : null;

  for (const host of hosts) {
    const field = createField(host);
    if (!field) continue;
    localFields.push(field);
    fieldMap.set(host, field);
    fields.add(field);
    resizeField(field);
    observer.observe(host);
    resizeObserver?.observe(host);
  }

  if (!localFields.length) {
    observer.disconnect();
    resizeObserver?.disconnect();
    return;
  }

  if (!started) {
    started = true;
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  document.addEventListener('pointermove', onPointerMove, { passive: true, signal });

  if (reducedMotion.matches) {
    for (const field of localFields) {
      field.visible = true;
      renderField(field, 4200, 0);
    }
  } else {
    // Observe triggers immediately with the current viewport intersection.
    requestAnimationFrame(() => wake());
  }

  signal.addEventListener('abort', () => {
    for (const field of localFields) {
      observer.unobserve(field.host);
      resizeObserver?.unobserve(field.host);
      fields.delete(field);
    }
    observer.disconnect();
    resizeObserver?.disconnect();
    if (fields.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });
}

function onVisibilityChange() {
  if (document.hidden) {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    return;
  }
  wake();
}
