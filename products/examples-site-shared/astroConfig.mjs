import { fileURLToPath } from 'node:url'

// The astro config every examples-site shares. A site's astro.config.mjs is not
// symlinked, so it imports this by a relative path, passing its own
// `import.meta.url` to anchor the `~site` alias; this file imports no package,
// since none resolves from here.
//
// `redirects` maps an old slug to the slug of the page that now covers it.
// Astro matches a redirect's key under `base` but writes its destination out
// as given, so the destination gets the base here.
//
// The RPC worker (imported via Vite's `?worker`) needs ES output because it
// code-splits. HMR is off in dev only to turn off React Fast Refresh, working
// around an upstream @vitejs/plugin-react bug: the worker shares the dev module
// graph with the main thread and imports Fast-Refresh-instrumented modules,
// which pull in `/@react-refresh` (it touches `window` at eval time) and
// reference the page preamble's `window.$RefreshSig$` — neither exists in a
// worker, so it throws. `server.hmr: false` is plugin-react's only dev lever for
// skipping Fast Refresh, and production builds strip it anyway. Remove once
// plugin-react makes its refresh runtime worker-safe (window -> globalThis).
export function examplesSiteConfig(
  configUrl,
  { base, integrations, redirects = {}, plugins = [] },
) {
  return {
    site: 'https://jbrowse.org',
    base,
    trailingSlash: 'always',
    redirects: Object.fromEntries(
      Object.entries(redirects).map(([from, to]) => [
        `/${from}`,
        `${base}/${to}/`,
      ]),
    ),
    integrations,
    vite: {
      resolve: {
        alias: { '~site': fileURLToPath(new URL('./src', configUrl)) },
      },
      worker: { format: 'es' },
      server: { hmr: false },
      plugins,
    },
  }
}
