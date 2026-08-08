// The `mode: 'embedded'` capture: the @jbrowse/react-linear-genome-view2
// component itself rather than the jbrowse-web app, mounted in a harness page
// that is the exact script-tag setup the embed tutorial documents.
//
// It serves its own bundle and screenshots the component element, so it shares
// only the readiness waits with the rest of the pipeline — see the note on
// EmbeddedSpec for the spec fields that therefore do nothing here.
import fs from 'node:fs'
import http from 'node:http'

import { optimizePng } from './image-pipeline.ts'
import { assertRenderSettled } from './screenshot-asserts.ts'
import { EMBED_UMD_PATH, tempPath } from './screenshot-options.ts'
import { waitForRasterize } from './screenshot-page.ts'
import { waitForReady } from './screenshot-ready.ts'
import { recordUnpainted } from './screenshot-report.ts'

import type { EmbeddedSpec } from './screenshot-specs.ts'
import type { Server } from 'node:http'
import type { Page } from 'puppeteer'

// Self-contained harness page for an embedded-component capture: load the UMD
// bundle and mount the LGV with the spec's createViewState arg, exactly the
// script-tag setup the embed tutorial documents.
function embeddedHarnessHtml(viewState: object) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body, #root { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="/jbrowse.umd.js"></script>
    <script>
      const { createViewState, JBrowseLinearGenomeView, React, createRoot } =
        window.JBrowseReactLinearGenomeView
      const viewState = createViewState(${JSON.stringify(viewState)})
      createRoot(document.getElementById('root')).render(
        React.createElement(JBrowseLinearGenomeView, { viewState }),
      )
    </script>
  </body>
</html>`
}

// Minimal static server for one embedded harness: '/' serves the harness HTML,
// '/jbrowse.umd.js' streams the prebuilt UMD bundle. Listens on an ephemeral
// port so concurrent embedded captures never collide.
function serveEmbeddedHarness(html: string, umdPath: string) {
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'
      if (url.startsWith('/jbrowse.umd.js.map')) {
        // Bundle carries a sourceMappingURL; serve the sibling map (devtools
        // only) so it doesn't 404.
        if (fs.existsSync(`${umdPath}.map`)) {
          res.writeHead(200, { 'content-type': 'application/json' })
          fs.createReadStream(`${umdPath}.map`).pipe(res)
        } else {
          res.writeHead(404)
          res.end()
        }
      } else if (url.startsWith('/jbrowse.umd.js')) {
        res.writeHead(200, { 'content-type': 'application/javascript' })
        fs.createReadStream(umdPath).pipe(res)
      } else if (url.startsWith('/favicon.ico')) {
        // The browser auto-requests a favicon for the bare harness page; answer
        // empty so it doesn't log a spurious 404.
        res.writeHead(204)
        res.end()
      } else if (url === '/' || url.startsWith('/index')) {
        res.writeHead(200, { 'content-type': 'text/html' })
        res.end(html)
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    server.on('error', reject)
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        resolve({ server, port: addr.port })
      } else {
        reject(new Error('embedded server failed to bind a port'))
      }
    })
  })
}

// Render an embedded-component spec to a finished temp PNG: serve the harness,
// drive the component to ready, then screenshot the component element (its full
// height, even past the viewport) rather than the page.
export async function captureEmbeddedToTemp(
  page: Page,
  spec: EmbeddedSpec,
  suffix = '',
) {
  if (!fs.existsSync(EMBED_UMD_PATH)) {
    throw new Error(
      `Embedded UMD not found at ${EMBED_UMD_PATH}. Build it with "pnpm --filter @jbrowse/react-linear-genome-view2 build:webpack".`,
    )
  }
  const { server, port } = await serveEmbeddedHarness(
    embeddedHarnessHtml(spec.viewState),
    EMBED_UMD_PATH,
  )
  try {
    await page.goto(`http://localhost:${port}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await waitForReady(page, spec)
    await waitForRasterize(page)

    // The same last gate `shoot` applies to every other capture. It used to be
    // skipped here purely because this function is reached by an early return
    // that steps over the shared path, so an embedded frame holding an error
    // banner, a stuck spinner or a region-too-large message would have been
    // written and reported as a success, which is the one outcome
    // screenshot-asserts.ts exists to prevent.
    //
    // Its two siblings stay out, and not by oversight. assertViewsPresent reads
    // the view tree out of a `session=spec-` query this harness has no URL for,
    // and assertViewsRendered looks for view-container test-ids the bare
    // component does not render. Both would be vacuous here rather than
    // permissive, and a check that cannot fail is worse than no check.
    if (!spec.allowUnsettled) {
      await assertRenderSettled(page, spec)
    }
    await recordUnpainted(page, spec.name)

    const renderPath = tempPath('jb-final', spec.name, suffix)
    const el = await page.$('#root')
    if (!el) {
      throw new Error('embedded harness #root not found')
    }
    await el.screenshot({ path: renderPath })
    optimizePng(renderPath)
    return renderPath
  } finally {
    // the page holds keep-alive sockets open; close() alone would leave the
    // handle (and the ephemeral port) alive until the browser exits
    server.closeAllConnections()
    server.close()
  }
}
