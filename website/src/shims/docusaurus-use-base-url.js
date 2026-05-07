// Shim for @docusaurus/useBaseUrl used in website/docs/figure.jsx.
// In Astro, BASE_URL is set at build time; this hook is no longer needed.
export default function useBaseUrl(url) {
  const base = import.meta.env.BASE_URL ?? '/'
  if (!url || url.startsWith('http') || url.startsWith('//')) {
    return url
  }
  return `${base.replace(/\/$/, '')  }/${  url.replace(/^\//, '')}`
}
