// Serve the built app and assert the example plugin renders.
//
// This is the only consumer that resolves @jbrowse/* the way a third-party
// plugin does: from packed tarballs, through each package's publishConfig
// exports map and built esm/, with its own vite + tsconfig and no workspace
// linking. An exports-map subpath rename, a path missing from a package's
// `files`, or a broken esm build fails here on every push, before release.
import http from 'node:http'
import path from 'node:path'

import puppeteer from 'puppeteer'
import handler from 'serve-handler'

const TIMEOUT = 60000

const server = http.createServer((req, res) => {
  void handler(req, res, { public: path.join(import.meta.dirname, 'dist') })
})
await new Promise<void>(resolve => {
  server.listen(0, resolve)
})
const { port } = server.address() as { port: number }

// --disable-gpu pins the renderer factory to Canvas2D, the same way
// browser-tests/runner.ts selects `canvas2d`. Rendering itself is covered
// there; this job is about packaging, which is backend-independent.
const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
})

const errors: string[] = []
try {
  const page = await browser.newPage()
  page.on('pageerror', e => errors.push(`pageerror: ${String(e)}`))
  page.on('console', m => {
    // A 404's URL is in location(), not text(), so a text-only filter never
    // matches the favicon Chrome requests on its own.
    const where = m.location().url ?? ''
    if (m.type() === 'error' && !`${m.text()} ${where}`.includes('favicon')) {
      errors.push(`console: ${m.text()} (${where})`)
    }
  })

  await page.goto(`http://localhost:${port}/`, { timeout: TIMEOUT })

  // DisplayChrome flips its base test-id to `-done` only once canvasDrawn
  // fires, so this one wait covers plugin install, display-type registration,
  // the custom RPC method resolving in a worker, and a draw.
  await page.waitForSelector('[data-testid="score-display-done"]', {
    timeout: TIMEOUT,
  })
} catch (e) {
  errors.push(String(e))
} finally {
  await browser.close()
  server.close()
}

for (const e of errors) {
  console.error(`  ✗ ${e}`)
}
if (errors.length === 0) {
  console.log('  ✓ score-example rendered against packed @jbrowse packages')
}
process.exit(errors.length > 0 ? 1 : 0)
