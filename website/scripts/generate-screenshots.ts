// Renders every figure the website publishes, from the specs in
// screenshot-specs.ts. Run it with `node`, not `npx tsx`: tsx's `keepNames`
// breaks the functions serialized into page context.
//
// This file prepares the run: what to render, the builds and the server it
// needs. The rest is one concern per module: screenshot-options (the CLI),
// -select (which specs), -pool (running them), -modes (each mode's render and
// commit), -browser (a capture's browser and its retry), -url and -embedded
// (the browser modes), -ready, -asserts, -page, and -report.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

import { createTestServer } from '@jbrowse/browser-test-utils'

import {
  buildPath,
  check,
  externalPort,
  repoRoot,
  servePort,
  testDataRoot,
} from './screenshot-options.ts'
import { runPool } from './screenshot-pool.ts'
import { printSummary } from './screenshot-report.ts'
import { selectSpecsToRender } from './screenshot-select.ts'

import type { ScreenshotSpec } from './screenshot-specs.ts'

function build(what: string, args: string[], failure: string) {
  console.log(what)
  try {
    execFileSync('pnpm', args, { cwd: repoRoot, stdio: 'inherit' })
  } catch {
    console.error(failure)
    process.exit(1)
  }
}

// jb2export runs from source but imports every @jbrowse/* package from its
// built esm/, which nothing else here reads, so a stale esm/ draws old code.
// `tsc --build` is incremental.
function buildWorkspaceEsm() {
  build(
    'Building workspace esm/ that jb2export specs render from',
    ['build:esm'],
    'pnpm build:esm failed — jb2export specs would render from a stale esm/',
  )
}

// The filter is the package name; `jbrowse-web` matches nothing and exits 0.
function buildJbrowseWeb() {
  build(
    'Building jbrowse-web',
    ['--filter', '@jbrowse/web', 'build'],
    'pnpm build failed — could not build jbrowse-web',
  )
}

// Only a url spec at a relative path reads jbrowse-web. Embedded specs serve
// their own harness, cli specs use no browser, and compose specs read PNGs.
async function startServerIfNeeded(specs: ScreenshotSpec[]) {
  if (!specs.some(s => s.mode === 'url' && !s.url.startsWith('http'))) {
    return undefined
  }
  if (!externalPort && !fs.existsSync(buildPath)) {
    buildJbrowseWeb()
  }
  const server = await createTestServer(servePort, {
    jbrowseWebRoot: testDataRoot,
    repoRoot,
    proxyPort: externalPort,
  })
  console.log(
    externalPort
      ? `Proxy on port ${servePort}, app on port ${externalPort}`
      : `Server on port ${servePort}`,
  )
  return server
}

async function main() {
  // undefined is "nothing to do", which a --affected run on a docs-only change
  // answers with exit 0
  const specs = await selectSpecsToRender()
  if (!specs) {
    return
  }
  if (specs.some(s => s.mode === 'cli')) {
    buildWorkspaceEsm()
  }
  const server = await startServerIfNeeded(specs)

  // A compose spec stacks other specs' committed PNGs, so it runs after them,
  // and --check, which commits nothing, skips it.
  const renderSpecs = specs.filter(s => s.mode !== 'compose')
  const composeSpecs = check ? [] : specs.filter(s => s.mode === 'compose')
  let totals
  try {
    totals = await runPool(renderSpecs, composeSpecs)
  } finally {
    server?.close()
  }

  printSummary(totals)
  // after every report prints: a --check run can be both flaky and failing
  if (totals.flaky.length > 0 || totals.failures.length > 0) {
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
