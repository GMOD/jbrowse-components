import esbuild from 'esbuild'

import type http from 'node:http'

// Bundle a review UI's page entry at server start, and serve it from memory.
//
// Kept to one build with no watcher on purpose: a review tool's contract is
// "run one node script, open localhost", offline, with no dev server and no
// install step beyond the repo's own. esbuild does react + react-dom + the page
// in a few hundred ms, which is well inside the time the tool already spends
// hashing figures, so a rebuild is a restart — same as it already is for the
// docs the server reads at startup.
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

export async function buildReviewPage(
  options: ReviewBundleOptions,
): Promise<ReviewBundle> {
  const result = await esbuild.build({
    entryPoints: [options.entry],
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
  })
  const text = (ext: string) =>
    result.outputFiles.find(f => f.path.endsWith(ext))?.text ?? ''
  const css = text('.css')
  return { html: shell(options, !!css), js: text('.js'), css }
}

// The three static routes a bundled review page needs. Returns false when the
// request was not one of them, so the caller's own routes read as a plain chain.
export function serveReviewBundle(
  res: http.ServerResponse,
  pathname: string,
  bundle: ReviewBundle,
): boolean {
  const send = (type: string, body: string) => {
    res.writeHead(200, {
      'Content-Type': type,
      // The bundle only changes when the server restarts, and a stale one is a
      // page running code that no longer matches its server.
      'Cache-Control': 'no-store',
    })
    res.end(body)
  }
  if (pathname === '/' || pathname === '/index.html') {
    send('text/html; charset=utf-8', bundle.html)
  } else if (pathname === '/app.js') {
    send('text/javascript; charset=utf-8', bundle.js)
  } else if (pathname === '/app.css') {
    send('text/css; charset=utf-8', bundle.css)
  } else {
    return false
  }
  return true
}
