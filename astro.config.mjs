// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const rawBase = (process.env.BASE_PATH || '').trim();
const base = !rawBase || rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;

// https://astro.build/config
export default defineConfig({
  // GitHub Actions supplies SITE_URL and BASE_PATH from configure-pages.
  // Local/root-domain builds fall back to example.com and the root path.
  site: process.env.SITE_URL || 'https://example.com',
  base,
  integrations: [sitemap()],
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  devToolbar: {
    enabled: false,
  },
});
