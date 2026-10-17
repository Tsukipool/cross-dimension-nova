/**
 * Prefix a root-absolute path with Astro's configured `base`.
 *
 * Local development and root-domain deployments use `base: '/'`, so this is a
 * no-op. GitHub Pages project sites build with `base: '/<repo>'`; every public
 * asset, internal page link, and media URL then needs the same prefix.
 */
const configuredBase = import.meta.env.BASE_URL || '/';
const base = configuredBase === '/' ? '' : configuredBase.replace(/\/+$/, '');

export function withBase(path: string): string {
  if (!path) return path;
  if (
    /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) ||
    path.startsWith('data:') ||
    path.startsWith('mailto:') ||
    path.startsWith('tel:') ||
    path.startsWith('#')
  ) {
    return path;
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!base) return normalized;
  if (normalized === base || normalized.startsWith(`${base}/`)) return normalized;
  return `${base}${normalized}`;
}

/** Remove the configured base prefix from a pathname for route checks. */
export function stripBase(path: string): string {
  if (!base) return path;
  if (path === base) return '/';
  if (path.startsWith(`${base}/`)) return path.slice(base.length);
  return path;
}
