import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initParticleFields } from './particles';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

// Give low-powered machines a lighter effects budget without changing the layout.
const lowPowerDevice =
  (navigator.hardwareConcurrency ?? 8) <= 4 ||
  ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
if (lowPowerDevice) document.documentElement.classList.add('low-power');

let lenis: Lenis | null = null;
let pageAbort: AbortController | null = null;
let siteReady = false;
let menuCloseTimer: number | undefined;
let lastFocused: HTMLElement | null = null;

declare global {
  interface Window {
    __novaReady?: boolean;
    __novaLenis?: Lenis;
  }
}

/* ------------------------------------------------------------------
   Helpers
------------------------------------------------------------------- */
const q = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  root.querySelector<T>(selector);

const qa = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(selector));

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function updateScrollLock() {
  const body = document.body;
  const locked = body.classList.contains('menu-open') || body.classList.contains('dialog-open') || body.classList.contains('preloading');
  if (!lenis) return;
  if (locked) lenis.stop();
  else lenis.start();
}

function getScrollPaddingTop() {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
  return Number.isFinite(value) ? value : 0;
}

function scrollToTarget(target: Element | number, immediate = false) {
  const behavior: ScrollBehavior = immediate || reducedMotion.matches ? 'auto' : 'smooth';

  if (!lenis) {
    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior });
      return;
    }
    target.scrollIntoView({ behavior, block: 'start' });
    return;
  }

  // Resolve an absolute destination from the *native* scroll position. Passing an
  // element to Lenis relies on its cached animatedScroll, which can be stale right
  // after a client-side navigation + ScrollTrigger refresh and land hundreds of
  // pixels above the section. Syncing first makes every jump deterministic.
  lenis.resize();
  const destination =
    typeof target === 'number'
      ? target
      : Math.max(0, target.getBoundingClientRect().top + window.scrollY - getScrollPaddingTop());

  lenis.scrollTo(destination, {
    offset: 0,
    duration: immediate ? 0 : 1.45,
    immediate,
    easing: (t: number) => 1 - Math.pow(1 - t, 4),
  });
}

function markSiteReady() {
  if (siteReady) return;
  siteReady = true;
  window.__novaReady = true;
  window.dispatchEvent(new CustomEvent('nova:site-ready'));
}

function updateScrollLockState() {
  updateScrollLock();
}

function closeAllDialogs() {
  qa<HTMLDialogElement>('dialog[open]').forEach((dialog) => dialog.close());
}

/* ------------------------------------------------------------------
   Lenis
------------------------------------------------------------------- */
function initLenis() {
  if (lenis || reducedMotion.matches) return;
  lenis = new Lenis({
    lerp: 0.09,
    wheelMultiplier: 0.92,
    touchMultiplier: 1.15,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: false,
  });
  window.__novaLenis = lenis;

  lenis.on('scroll', () => {
    ScrollTrigger.update();
  });

  gsap.ticker.add((time) => {
    lenis?.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);
}

/* ------------------------------------------------------------------
   Intro / preloader
------------------------------------------------------------------- */
function playIntro(signal: AbortSignal) {
  const preloader = q<HTMLElement>('[data-preloader]');

  let alreadyPlayed = false;
  try {
    alreadyPlayed = sessionStorage.getItem('nova-intro-played') === '1';
  } catch {
    alreadyPlayed = false;
  }

  if (!preloader || reducedMotion.matches || alreadyPlayed) {
    preloader?.remove();
    markSiteReady();
    return;
  }

  document.body.classList.add('preloading');
  updateScrollLockState();

  const count = q<HTMLElement>('[data-preloader-count]', preloader);
  const bar = q<HTMLElement>('[data-preloader-bar]', preloader);
  const inner = q<HTMLElement>('.preloader__inner', preloader);
  const counter = { value: 0 };

  const finish = () => {
    preloader.remove();
    document.documentElement.classList.add('skip-preloader');
    try {
      sessionStorage.setItem('nova-intro-played', '1');
    } catch {
      /* ignore */
    }
    document.body.classList.remove('preloading');
    updateScrollLockState();
    markSiteReady();
  };

  if (!count || !bar || !inner) {
    finish();
    return;
  }

  const tl = gsap.timeline();
  tl.to(counter, {
    value: 100,
    duration: 1.35,
    ease: 'power2.inOut',
    onUpdate: () => {
      count.textContent = String(Math.round(counter.value)).padStart(2, '0');
      gsap.set(bar, { scaleX: counter.value / 100 });
    },
  })
    .to(inner, { y: -18, opacity: 0, duration: 0.45, ease: 'power2.in' }, '+=0.12')
    .to(preloader, { yPercent: -100, duration: 0.95, ease: 'power4.inOut' }, '-=0.12')
    .add(finish);

  signal.addEventListener('abort', () => {
    tl.kill();
    preloader.remove();
    document.body.classList.remove('preloading');
  });
}

/* ------------------------------------------------------------------
   Reveals
------------------------------------------------------------------- */
function initReveals(signal: AbortSignal) {
  const targets = qa<HTMLElement>('[data-reveal], [data-reveal-group], .line-mask').filter(
    (el) => !el.closest('.hero'),
  );

  if (!targets.length) return;

  if (reducedMotion.matches) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -7% 0px' },
  );

  targets.forEach((target) => observer.observe(target));
  signal.addEventListener('abort', () => observer.disconnect());
}

/* ------------------------------------------------------------------
   Navigation, menu, scroll progress
------------------------------------------------------------------- */
function initNav(signal: AbortSignal) {
  const nav = q<HTMLElement>('[data-nav]');
  const progress = q<HTMLElement>('[data-scroll-progress]');
  const menu = q<HTMLElement>('[data-menu]');
  const toggle = q<HTMLButtonElement>('[data-menu-toggle]');
  const menuLabel = q<HTMLElement>('[data-menu-label]');
  const menuLinks = qa<HTMLAnchorElement>('[data-menu-link]');

  let menuOpen = false;

  const onScroll = () => {
    const scrollTop = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    nav?.classList.toggle('is-scrolled', scrollTop > 24);
    if (progress) progress.style.transform = `scaleX(${clamp(scrollTop / max)})`;
  };

  window.addEventListener('scroll', onScroll, { passive: true, signal });
  onScroll();

  const openMenu = () => {
    if (!menu || !toggle || menuOpen) return;
    menuOpen = true;
    window.clearTimeout(menuCloseTimer);
    lastFocused = document.activeElement as HTMLElement;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '关闭菜单');
    nav?.classList.add('is-menu-open');
    if (menuLabel) menuLabel.textContent = 'CLOSE';
    document.body.classList.add('menu-open', 'is-menu-open');
    q('main')?.setAttribute('inert', '');
    q('.footer')?.setAttribute('inert', '');
    updateScrollLockState();
    menuCloseTimer = window.setTimeout(() => {
      menuLinks[0]?.focus({ preventScroll: true });
    }, 560);
  };

  const closeMenu = (restoreFocus = false) => {
    if (!menu || !toggle || !menuOpen) return;
    menuOpen = false;
    window.clearTimeout(menuCloseTimer);
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '打开菜单');
    nav?.classList.remove('is-menu-open');
    if (menuLabel) menuLabel.textContent = 'MENU';
    document.body.classList.remove('menu-open', 'is-menu-open');
    q('main')?.removeAttribute('inert');
    q('.footer')?.removeAttribute('inert');
    updateScrollLockState();
    if (restoreFocus) {
      (lastFocused ?? toggle).focus({ preventScroll: true });
    }
  };

  toggle?.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()), { signal });

  menuLinks.forEach((link) => {
    link.addEventListener(
      'click',
      () => {
        menuCloseTimer = window.setTimeout(() => closeMenu(), 60);
      },
      { signal },
    );
  });

  document.addEventListener(
    'click',
    (event) => {
      if (!menuOpen) return;
      const link = (event.target as Element).closest('a[data-nav-link]');
      if (link && !link.closest('[data-menu]')) closeMenu();
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && menuOpen) closeMenu(true);
      if (event.key !== 'Tab' || !menuOpen || !toggle) return;

      const focusables = [toggle, ...menuLinks].filter(
        (element) => element && element.offsetParent !== null && !element.closest('[inert]'),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === toggle)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal },
  );

  window.addEventListener(
    'resize',
    () => {
      if (window.innerWidth > 1100 && menuOpen) closeMenu();
    },
    { passive: true, signal },
  );

  // Same-page anchor navigation
  document.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.classList.contains('skip-link')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.hash && url.pathname === window.location.pathname) {
        const target = q(decodeURIComponent(url.hash));
        if (!target) return;
        event.preventDefault();
        closeMenu();
        window.setTimeout(() => scrollToTarget(target), 30);
        history.pushState(null, '', url.hash);
      }
    },
    { signal },
  );

  q<HTMLButtonElement>('[data-back-to-top]')?.addEventListener(
    'click',
    () => {
      scrollToTarget(0);
    },
    { signal },
  );

  const article = q<HTMLElement>('[data-article]');
  const readingBar = q<HTMLElement>('[data-reading-progress]');
  const readingPercent = q<HTMLElement>('[data-reading-percent]');
  if (article && readingBar) {
    const updateReading = () => {
      const rect = article.getBoundingClientRect();
      const start = window.innerHeight * 0.72;
      const total = rect.height - window.innerHeight * 0.35;
      const value = clamp((start - rect.top) / Math.max(1, total));
      readingBar.style.transform = `scaleX(${value})`;
      if (readingPercent) readingPercent.textContent = `${Math.round(value * 100)}%`;
    };
    window.addEventListener('scroll', updateReading, { passive: true, signal });
    updateReading();
  }

  // Jump to hash after client-side navigation
  if (window.location.hash) {
    const jump = () => {
      const target = q(decodeURIComponent(window.location.hash));
      if (target) window.setTimeout(() => scrollToTarget(target, true), 90);
    };
    if (window.__novaReady) jump();
    else window.addEventListener('nova:site-ready', jump, { signal, once: true });
  }

  // Close menu during navigation
  signal.addEventListener('abort', () => closeMenu());
}

/* ------------------------------------------------------------------
   Hero
------------------------------------------------------------------- */
function initHero(signal: AbortSignal) {
  const hero = q<HTMLElement>('.hero');
  if (!hero) return;

  const fades = qa<HTMLElement>('[data-hero-fade]', hero);
  const cards = qa<HTMLElement>('[data-hero-card]', hero);
  const scrollLayers = qa<HTMLElement>('[data-hero-scroll]', hero);
  const depthLayers = qa<HTMLElement>('[data-depth]', hero);

  if (!reducedMotion.matches) {
    gsap.set(fades, { autoAlpha: 0, y: 24 });
    gsap.set(cards, { autoAlpha: 0, y: 55, scale: 0.965 });
  }

  const revealHero = () => {
    if (hero.dataset.played === 'true') return;
    hero.dataset.played = 'true';
    hero.classList.add('is-ready');
    if (reducedMotion.matches) return;

    gsap.to(fades, {
      autoAlpha: 1,
      y: 0,
      duration: 1.1,
      stagger: 0.09,
      delay: 0.15,
      ease: 'power3.out',
    });
    gsap.to(cards, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 1.35,
      stagger: 0.13,
      delay: 0.25,
      ease: 'power3.out',
      clearProps: 'transform',
    });
  };

  if (window.__novaReady) revealHero();
  else window.addEventListener('nova:site-ready', revealHero, { signal, once: true });

  if (reducedMotion.matches) {
    hero.classList.add('is-ready');
    hero.dataset.played = 'true';
    return;
  }

  // Scroll-linked parallax
  scrollLayers.forEach((layer, index) => {
    const speed = Number(layer.dataset.heroScroll || 1);
    gsap.fromTo(
      layer,
      { y: 0 },
      {
        y: -(60 + index * 34) * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      },
    );
  });

  const content = q<HTMLElement>('[data-hero-content]', hero);
  if (content) {
    gsap.to(content, {
      yPercent: -8,
      opacity: 0.28,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: '30% top',
        end: 'bottom top',
        scrub: 1,
      },
    });
  }

  // Pointer depth
  if (finePointer.matches) {
    const movers = depthLayers.map((layer) => ({
      depth: Number(layer.dataset.depth) || 1,
      x: gsap.quickTo(layer, 'x', { duration: 1.1, ease: 'power2.out' }),
      y: gsap.quickTo(layer, 'y', { duration: 1.1, ease: 'power2.out' }),
    }));

    hero.addEventListener(
      'pointermove',
      (event) => {
        const nx = event.clientX / window.innerWidth - 0.5;
        const ny = event.clientY / window.innerHeight - 0.5;
        movers.forEach((mover) => {
          mover.x(nx * 54 * mover.depth);
          mover.y(ny * 38 * mover.depth);
        });
      },
      { passive: true, signal },
    );

    hero.addEventListener(
      'pointerleave',
      () => {
        movers.forEach((mover) => {
          mover.x(0);
          mover.y(0);
        });
      },
      { signal },
    );
  }
}

/* ------------------------------------------------------------------
   Cursor
------------------------------------------------------------------- */
function initCursor(signal: AbortSignal) {
  if (!finePointer.matches || reducedMotion.matches) return;

  const cursor = q<HTMLElement>('[data-cursor]');
  const dot = q<HTMLElement>('[data-cursor-dot]');
  const ring = q<HTMLElement>('[data-cursor-ring]');
  const label = q<HTMLElement>('[data-cursor-label]');
  if (!cursor || !dot || !ring || !label) return;

  document.body.classList.add('custom-cursor');
  gsap.set([dot, ring], { x: -100, y: -100 });

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3.out' });

  const onMove = (event: PointerEvent) => {
    cursor.classList.remove('is-hidden');
    dotX(event.clientX);
    dotY(event.clientY);
    ringX(event.clientX);
    ringY(event.clientY);
  };

  document.addEventListener('pointermove', onMove, { passive: true, signal });
  document.addEventListener(
    'pointerleave',
    () => {
      cursor.classList.add('is-hidden');
    },
    { signal },
  );
  document.addEventListener(
    'pointerenter',
    () => {
      cursor.classList.remove('is-hidden');
    },
    { signal },
  );

  document.addEventListener(
    'pointerover',
    (event) => {
      const target = event.target as Element;
      const interactive = target.closest('a, button, [data-cursor-hover]');
      const labelHost = target.closest<HTMLElement>('[data-cursor-label]');
      cursor.classList.toggle('is-hover', Boolean(interactive));
      if (labelHost) {
        label.textContent = labelHost.dataset.cursorLabel || 'View';
        cursor.classList.add('has-label');
      } else {
        cursor.classList.remove('has-label');
      }
    },
    { signal },
  );

  // Hide cursor when the pointer leaves the document.
  document.documentElement.addEventListener(
    'mouseleave',
    () => cursor.classList.add('is-hidden'),
    { signal },
  );
}

/* ------------------------------------------------------------------
   3D card tilt + magnetic elements
------------------------------------------------------------------- */
function initTilt(signal: AbortSignal) {
  if (!finePointer.matches || reducedMotion.matches) return;

  qa<HTMLElement>('[data-tilt]').forEach((card) => {
    let frame = 0;
    let rect: DOMRect | null = null;
    let measuredScroll = 0;
    let clientX = 0;
    let clientY = 0;
    let active = false;

    const applyTilt = () => {
      frame = 0;
      if (!active || !rect) return;

      // Cards only move vertically with page scroll. Adjusting the cached rect
      // avoids a getBoundingClientRect() call on every pointermove.
      const top = rect.top - (window.scrollY - measuredScroll);
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - top) / rect.height));

      card.style.setProperty('--ry', `${((x - 0.5) * 7).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-(y - 0.5) * 7).toFixed(2)}deg`);
      card.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(applyTilt);
    };

    const onEnter = (event: PointerEvent) => {
      rect = card.getBoundingClientRect();
      measuredScroll = window.scrollY;
      clientX = event.clientX;
      clientY = event.clientY;
      active = true;
      card.classList.add('is-tilting');
      schedule();
    };

    const onMove = (event: PointerEvent) => {
      if (!active) return;
      clientX = event.clientX;
      clientY = event.clientY;
      schedule();
    };

    const onLeave = () => {
      active = false;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      rect = null;
      card.classList.remove('is-tilting');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--gx', '50%');
      card.style.setProperty('--gy', '50%');
    };

    card.addEventListener('pointerenter', onEnter, { signal });
    card.addEventListener('pointermove', onMove, { passive: true, signal });
    card.addEventListener('pointerleave', onLeave, { signal });
    signal.addEventListener('abort', () => {
      if (frame) cancelAnimationFrame(frame);
    });
  });
}

function initMagnetic(signal: AbortSignal) {
  if (!finePointer.matches || reducedMotion.matches) return;

  qa<HTMLElement>('[data-magnetic]').forEach((el) => {
    let rect: DOMRect | null = null;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });

    el.addEventListener('pointerenter', () => {
      rect = el.getBoundingClientRect();
    }, { signal });

    el.addEventListener(
      'pointermove',
      (event) => {
        if (!rect) rect = el.getBoundingClientRect();
        xTo((event.clientX - (rect.left + rect.width / 2)) * 0.22);
        yTo((event.clientY - (rect.top + rect.height / 2)) * 0.28);
      },
      { passive: true, signal },
    );

    el.addEventListener(
      'pointerleave',
      () => {
        rect = null;
        xTo(0);
        yTo(0);
      },
      { signal },
    );
  });
}

/* ------------------------------------------------------------------
   Lightbox
------------------------------------------------------------------- */
function initLightbox(signal: AbortSignal) {
  const dialog = q<HTMLDialogElement>('[data-lightbox]');
  if (!dialog) return;

  const image = q<HTMLImageElement>('[data-lightbox-img]', dialog);
  const captionEl = q<HTMLElement>('[data-lightbox-caption]', dialog);
  const countEl = q<HTMLElement>('[data-lightbox-count]', dialog);
  const prev = q<HTMLButtonElement>('[data-lightbox-prev]', dialog);
  const next = q<HTMLButtonElement>('[data-lightbox-next]', dialog);
  const closeBtn = q<HTMLButtonElement>('[data-lightbox-close]', dialog);
  if (!image || !captionEl || !countEl || !prev || !next) return;

  let items: HTMLElement[] = [];
  let activeIndex = 0;
  let returnFocus: HTMLElement | null = null;

  const render = () => {
    const item = items[activeIndex];
    if (!item) return;
    const src = item.dataset.src || '';
    const alt = item.dataset.alt || '';
    const caption = item.dataset.caption || '';
    image.classList.add('is-loading');
    image.src = src;
    image.alt = alt;
    image.onload = () => image.classList.remove('is-loading');
    captionEl.textContent = caption;
    countEl.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    prev.disabled = activeIndex === 0;
    next.disabled = activeIndex === items.length - 1;
    dialog.setAttribute('aria-label', `${alt} · 图片预览`);
  };

  const open = (item: HTMLElement) => {
    const group = item.closest('[data-lightbox-group]');
    items = group ? qa<HTMLElement>('[data-lightbox-item]', group) : [item];
    activeIndex = Math.max(0, items.indexOf(item));
    returnFocus = document.activeElement as HTMLElement;
    render();
    dialog.showModal();
    document.body.classList.add('dialog-open');
    updateScrollLockState();
    closeBtn?.focus({ preventScroll: true });
  };

  const close = () => {
    if (dialog.open) dialog.close();
  };

  document.addEventListener(
    'click',
    (event) => {
      const item = (event.target as Element).closest<HTMLElement>('[data-lightbox-item]');
      if (item) {
        event.preventDefault();
        open(item);
      }
    },
    { signal },
  );

  closeBtn?.addEventListener('click', close, { signal });
  prev.addEventListener(
    'click',
    () => {
      if (activeIndex > 0) {
        activeIndex -= 1;
        render();
      }
    },
    { signal },
  );
  next.addEventListener(
    'click',
    () => {
      if (activeIndex < items.length - 1) {
        activeIndex += 1;
        render();
      }
    },
    { signal },
  );

  dialog.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element;
      if (target === dialog || (target.closest('.lightbox__stage') && !target.closest('.lightbox__figure'))) {
        close();
      }
    },
    { signal },
  );

  dialog.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (activeIndex > 0) {
          activeIndex -= 1;
          render();
        }
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (activeIndex < items.length - 1) {
          activeIndex += 1;
          render();
        }
      }
    },
    { signal },
  );

  dialog.addEventListener(
    'close',
    () => {
      document.body.classList.remove('dialog-open');
      updateScrollLockState();
      image.src = '';
      if (returnFocus) returnFocus.focus({ preventScroll: true });
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Video modal
------------------------------------------------------------------- */
function initVideoModal(signal: AbortSignal) {
  const dialog = q<HTMLDialogElement>('[data-video-modal]');
  const player = q<HTMLVideoElement>('[data-video-player]', dialog ?? document);
  if (!dialog || !player) return;

  let returnFocus: HTMLElement | null = null;

  document.addEventListener(
    'click',
    (event) => {
      const trigger = (event.target as Element).closest<HTMLElement>('[data-open-video]');
      if (!trigger) return;
      event.preventDefault();
      const src = trigger.dataset.videoSrc;
      if (!src) return;
      returnFocus = document.activeElement as HTMLElement;
      player.src = src;
      if (trigger.dataset.videoPoster) player.poster = trigger.dataset.videoPoster;
      dialog.showModal();
      document.body.classList.add('dialog-open');
      updateScrollLockState();
      player.play().catch(() => {
        /* autoplay can be blocked; native controls remain available */
      });
    },
    { signal },
  );

  const close = () => {
    if (dialog.open) dialog.close();
  };

  q<HTMLButtonElement>('[data-video-close]', dialog)?.addEventListener('click', close, { signal });

  dialog.addEventListener(
    'click',
    (event) => {
      if (event.target === dialog) close();
    },
    { signal },
  );

  dialog.addEventListener(
    'close',
    () => {
      player.pause();
      player.removeAttribute('src');
      player.removeAttribute('poster');
      player.load();
      document.body.classList.remove('dialog-open');
      updateScrollLockState();
      if (returnFocus) returnFocus.focus({ preventScroll: true });
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Works archive filter
------------------------------------------------------------------- */
function initWorkFilters(signal: AbortSignal) {
  const grid = q<HTMLElement>('[data-work-grid]');
  const buttons = qa<HTMLButtonElement>('[data-filter]');
  if (!grid || !buttons.length) return;

  const cards = qa<HTMLElement>('[data-work-type]', grid);
  const countEl = q<HTMLElement>('[data-works-visible]');
  let current = 'all';
  let animating = false;

  const validTypes = ['all', 'illustration', 'novel', 'video'];

  const applyClasses = (type: string) => {
    cards.forEach((card) => {
      const match = type === 'all' || card.dataset.workType === type;
      card.classList.toggle('is-filtered-out', !match);
      card.setAttribute('aria-hidden', match ? 'false' : 'true');
    });
    const visible = cards.filter((card) => !card.classList.contains('is-filtered-out')).length;
    if (countEl) countEl.textContent = String(visible).padStart(2, '0');
    buttons.forEach((button) => {
      const active = button.dataset.filter === type;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    grid.classList.toggle('is-filtered', type !== 'all');
    current = type;
  };

  const apply = (type: string, animate = true) => {
    if (animating || type === current) return;
    if (animate && !reducedMotion.matches) {
      animating = true;
      const visible = cards.filter((card) => !card.classList.contains('is-filtered-out'));
      gsap.to(visible, {
        opacity: 0,
        y: 10,
        duration: 0.22,
        stagger: 0.018,
        ease: 'power2.in',
        onComplete: () => {
          applyClasses(type);
          const shown = cards.filter((card) => !card.classList.contains('is-filtered-out'));
          gsap.fromTo(
            shown,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.7,
              stagger: 0.05,
              ease: 'power3.out',
              clearProps: 'opacity,transform',
              onComplete: () => {
                animating = false;
              },
            },
          );
        },
      });
    } else {
      applyClasses(type);
    }

    const url = new URL(window.location.href);
    if (type === 'all') url.searchParams.delete('type');
    else url.searchParams.set('type', type);
    history.replaceState(null, '', url);
  };

  buttons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const type = button.dataset.filter || 'all';
        if (!validTypes.includes(type)) return;
        apply(type);
      },
      { signal },
    );
  });

  const initial = new URL(window.location.href).searchParams.get('type') || 'all';
  const startType = validTypes.includes(initial) ? initial : 'all';
  applyClasses(startType);

  if (!reducedMotion.matches) {
    gsap.fromTo(
      cards.filter((card) => !card.classList.contains('is-filtered-out')),
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.85, stagger: 0.045, ease: 'power3.out', delay: 0.15, clearProps: 'opacity,transform' },
    );
  }
}

/* ------------------------------------------------------------------
   Page lifecycle
------------------------------------------------------------------- */
function initPage() {
  if (document.body.dataset.runtimeReady === '1') return;
  document.body.dataset.runtimeReady = '1';

  pageAbort?.abort();
  pageAbort = new AbortController();
  const signal = pageAbort.signal;

  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  initLenis();

  initReveals(signal);
  initNav(signal);
  initHero(signal);
  initCursor(signal);
  initTilt(signal);
  initMagnetic(signal);
  initParticleFields(signal);
  initLightbox(signal);
  initVideoModal(signal);
  initWorkFilters(signal);
  playIntro(signal);

  // Refresh measurements once fonts and imagery settle.
  if ('fonts' in document) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener(
    'load',
    () => {
      ScrollTrigger.refresh();
    },
    { once: true, signal },
  );
}

function cleanupPage() {
  pageAbort?.abort();
  pageAbort = null;
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  closeAllDialogs();
  window.clearTimeout(menuCloseTimer);

  const menu = q<HTMLElement>('[data-menu]');
  menu?.classList.remove('is-open');
  menu?.setAttribute('aria-hidden', 'true');
  const toggle = q<HTMLButtonElement>('[data-menu-toggle]');
  toggle?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open', 'is-menu-open', 'dialog-open', 'preloading');
  if (lenis) lenis.start();
  delete document.body.dataset.runtimeReady;
}

document.addEventListener('astro:before-swap', () => {
  cleanupPage();
});

document.addEventListener('astro:page-load', () => {
  initPage();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage, { once: true });
} else {
  initPage();
}
