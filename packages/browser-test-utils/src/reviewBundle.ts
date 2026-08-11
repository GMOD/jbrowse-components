import esbuild from 'esbuild'

import type http from 'node:http'

// Bundle a review UI's page entry with esbuild, and serve it from memory.
//
// There is no watcher and no dev server: a review tool's contract is "run one
// node script, open localhost", offline, with no install step beyond the repo's
// own. What there IS is a rebuild on every page load, which gets the same thing
// a watcher would for none of the machinery — the reviewer's loop is already
// edit, RELOAD, look again, and an incremental esbuild of react + react-dom +
// the page is tens of ms against the seconds that load already spends hashing
// figures. Before this the bundle was built once at startup, so editing the page
// meant restarting the server, and the usual way to find that out was reloading
// several times and wondering why the change was not there.
//
// This module is imported by the tool's server, which node runs directly with
// type stripping. It stays plain TypeScript for that reason; the page entry it
// points at is JSX and is only ever seen by esbuild.

export interface ReviewBundleOptions {
  // absolute path to the page's .tsx entry
  entry: string
  // <title>, and the h1 the page draws for itself
  title: string
  // one emoji, inlined as an SVG favicon. Both to stop the /favicon.ico 404
  // putting a red line in the console on every load, and to tell this tab apart
  // from the other review UI — the two tools are expected to be open beside
  // each other.
  favicon: string
}

export interface ReviewBundle {
  html: string
  js: string
  css: string
}

function esbuildOptions(entry: string) {
  return {
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    jsx: 'automatic',
    platform: 'browser',
    // an outdir makes the two output paths predictable without writing either
    outdir: '/review',
    write: false,
    // A tool whose whole reason for existing is that it kept having bugs is a
    // tool worth being able to read a stack trace in. It is localhost and the
    // cost is bytes off a loopback socket.
    sourcemap: 'inline',
    // react-dom reads this and throws a bare `process is not defined` without
    // it. Development, deliberately: the hook-order and key warnings are the
    // ones that catch a bad edit to this page before a reviewer does.
    define: { 'process.env.NODE_ENV': '"development"' },
  } satisfies esbuild.BuildOptions
}

function shell({ title, favicon }: ReviewBundleOptions, hasCss: boolean) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="icon" href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${favicon}</text></svg>'>
${hasCss ? '<link rel="stylesheet" href="/app.css" />' : ''}
</head>
<body>
<div id="root"></div>
<script type="module" src="/app.js"></script>
</body>
</html>`
}

function toBundle(
  options: ReviewBundleOptions,
  outputFiles: esbuild.OutputFile[],
): ReviewBundle {
  const text = (ext: string) =>
    outputFiles.find(f => f.path.endsWith(ext))?.text ?? ''
  const css = text('.css')
  return { html: shell(options, !!css), js: text('.js'), css }
}

// A one-shot build, for a caller that wants the bytes and then exits — the
// review-client probe inlines `js` into a `page.setContent` and never serves a
// route. Servers want `createReviewBundle` instead.
export async function buildReviewPage(
  options: ReviewBundleOptions,
): Promise<ReviewBundle> {
  const result = await esbuild.build(esbuildOptions(options.entry))
  return toBundle(options, result.outputFiles)
}

export interface ReviewBundleHost {
  // the tool's own name, for the build-failure page's <title>
  title: string
  // The last build that SUCCEEDED. `/app.js` and `/app.css` are served from
  // here, and a failed rebuild deliberately leaves it alone: the error goes to
  // the page (see serveReviewBundle) rather than replacing a working bundle
  // with nothing.
  latest: ReviewBundle
  // Resolves to the fresh bundle, or rejects with esbuild's own formatted
  // message. Cheap when nothing changed — esbuild's incremental build caches
  // the whole graph.
  rebuild: () => Promise<ReviewBundle>
  // esbuild's context holds a child process open, so a server that stops
  // listening still would not exit without this.
  dispose: () => Promise<void>
}

// A bundle that rebuilds on demand. The initial build happens here, before the
// caller starts listening, so a syntax error in the page is still a startup
// failure carrying esbuild's own message rather than a blank tab.
export async function createReviewBundle(
  options: ReviewBundleOptions,
): Promise<ReviewBundleHost> {
  const ctx = await esbuild.context(esbuildOptions(options.entry))
  const host: ReviewBundleHost = {
    title: options.title,
    latest: toBundle(options, (await ctx.rebuild()).outputFiles),
    rebuild: async () => {
      const result = await ctx.rebuild()
      host.latest = toBundle(options, result.outputFiles)
      return host.latest
    },
    dispose: () => ctx.dispose(),
  }
  return host
}

// esbuild's errors are already formatted with the source frame; this is only
// what puts them somewhere the reviewer will see. Without it a broken edit to
// the page serves the last good bundle forever and looks like the edit did
// nothing.
function errorPage(title: string, message: string) {
  const escaped = message.replaceAll(
    /[&<>]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!,
  )
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>${title} — build failed</title></head>
<body style="font:13px/1.5 ui-monospace,monospace;padding:2rem;background:#1c1917;color:#e7e5e4">
<h1 style="font-size:15px;color:#fca5a5">The review page did not compile</h1>
<pre style="white-space:pre-wrap">${escaped}</pre>
<p style="color:#a8a29e">Fix it and reload — the server does not need restarting.</p>
</body>
</html>`
}

// The three static routes a bundled review page needs. Returns false when the
// request was not one of them, so the caller's own routes read as a plain chain.
//
// The rebuild hangs off the HTML route alone, which is exactly one rebuild per
// reload: the page's own script and stylesheet are fetched only after this
// route has answered, so by the time they arrive `latest` is already the build
// the HTML was sent for. Hitting /app.js directly serves the last build, which
// is the only coherent answer to a request that named no page.
export function serveReviewBundle(
  res: http.ServerResponse,
  pathname: string,
  bundle: ReviewBundleHost,
): boolean {
  const send = (type: string, body: string) => {
    res.writeHead(200, {
      'Content-Type': type,
      // The bundle changes under a running server now, and a stale one is a
      // page running code that no longer matches its server.
      'Cache-Control': 'no-store',
    })
    res.end(body)
  }
  if (pathname === '/' || pathname === '/index.html') {
    bundle.rebuild().then(
      fresh => {
        send('text/html; charset=utf-8', fresh.html)
      },
      (err: unknown) => {
        send('text/html; charset=utf-8', errorPage(bundle.title, `${err}`))
      },
    )
  } else if (pathname === '/app.js') {
    send('text/javascript; charset=utf-8', bundle.latest.js)
  } else if (pathname === '/app.css') {
    send('text/css; charset=utf-8', bundle.latest.css)
  } else {
    return false
  }
  return true
}
