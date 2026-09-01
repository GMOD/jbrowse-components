// MCP conformance: launches the built app (renderer served from build/, main
// from build/electron.js), connects the stdio server to its bridge socket, and
// exercises the four tools against the volvox test config. The scenarios are
// the regressions found while building this surface: refName renaming (a VCF
// spelling contigA must answer a ctgA query), bulk in-place display settings,
// live-getter inspection, run_javascript globalThis persistence, gene-name
// navigation, and open waiting for the new session identity.
//
// Prereqs: `pnpm build && pnpm build:electron-main`. With another JBrowse
// Desktop instance running, the single-instance lock forwards the launch there
// and the checks run against it instead. `--attach` skips launching entirely.
//
// Usage: node test/mcpConformance.ts [--attach]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import net from 'node:net'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { defaultSocketPath } from '../electron/mcp/socketPath.ts'

import type { ChildProcess } from 'node:child_process'

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const repoRoot = path.resolve(desktopRoot, '../..')
const volvoxConfig = path.join(repoRoot, 'test_data/volvox/config.json')
const attach = process.argv.includes('--attach')

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

function serveRendererBuild() {
  const buildDir = path.join(desktopRoot, 'build')
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const file = path.join(buildDir, rel)
    if (file.startsWith(buildDir) && fs.existsSync(file)) {
      res.setHeader(
        'content-type',
        MIME[path.extname(file)] ?? 'application/octet-stream',
      )
      fs.createReadStream(file).pipe(res)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  return new Promise<{ port: number; close: () => void }>(resolve => {
    server.listen(0, () => {
      const address = server.address()
      resolve({
        port: typeof address === 'object' && address ? address.port : 0,
        close: () => {
          server.close()
        },
      })
    })
  })
}

async function waitForBridge(timeoutMs: number) {
  const socketPath = defaultSocketPath()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const connected = await new Promise<boolean>(resolve => {
      const s = net.createConnection(socketPath, () => {
        s.destroy()
        resolve(true)
      })
      s.on('error', () => {
        resolve(false)
      })
    })
    if (connected) {
      return
    }
    if (Date.now() > deadline) {
      throw new Error(`bridge socket ${socketPath} never came up`)
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

interface ToolContent {
  type: string
  text?: string
  data?: string
}
interface JsonRpcResponse {
  id: number
  result?: { content?: ToolContent[]; isError?: boolean }
  error?: { message: string }
}

function startMcpClient() {
  const child = spawn('node', [path.join(desktopRoot, 'build/mcpServer.js')], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const waiters: ((r: JsonRpcResponse) => void)[] = []
  readline.createInterface({ input: child.stdout! }).on('line', line => {
    waiters.shift()?.(JSON.parse(line) as JsonRpcResponse)
  })
  let nextId = 0
  async function rpc(method: string, params: Record<string, unknown>) {
    const id = ++nextId
    child.stdin!.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
    )
    return new Promise<JsonRpcResponse>(resolve => waiters.push(resolve))
  }
  async function call(name: string, args: Record<string, unknown> = {}) {
    const response = await rpc('tools/call', { name, arguments: args })
    const content = response.result?.content?.[0]
    if (response.error ?? response.result?.isError) {
      throw new Error(
        `${name}: ${response.error?.message ?? content?.text ?? 'tool error'}`,
      )
    }
    return content
  }
  async function callJson(name: string, args: Record<string, unknown> = {}) {
    return JSON.parse((await call(name, args))?.text ?? 'null') as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >
  }
  return {
    rpc,
    call,
    callJson,
    stop: () => {
      child.stdin!.end()
    },
  }
}

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`ok    ${name}`)
  } else {
    console.error(`FAIL  ${name}`, detail === undefined ? '' : detail)
    process.exitCode = 1
  }
}

let app: ChildProcess | undefined
let rendererServer: { port: number; close: () => void } | undefined
try {
  if (!attach) {
    rendererServer = await serveRendererBuild()
    const require = createRequire(import.meta.url)
    app = spawn(
      require('electron') as unknown as string,
      ['.', '--no-sandbox', volvoxConfig],
      {
        cwd: desktopRoot,
        stdio: 'ignore',
        env: {
          ...process.env,
          DEV_SERVER_URL: `http://localhost:${rendererServer.port}`,
        },
      },
    )
  }
  await waitForBridge(attach ? 5000 : 90_000)
  const mcp = startMcpClient()
  await mcp.rpc('initialize', { protocolVersion: '2025-06-18' })

  // the bridge listens from app-ready, before the window and its session exist
  const sessionDeadline = Date.now() + 120_000
  for (;;) {
    try {
      await mcp.callJson('run_javascript', {
        code: 'return jb.sessionSummary()',
      })
      break
    } catch (e) {
      if (Date.now() > sessionDeadline) {
        throw e
      }
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  const listed = await mcp.rpc('tools/list', {})
  const names = (
    listed.result as unknown as { tools: { name: string }[] }
  ).tools.map(t => t.name)
  check(
    'tools/list is exactly the four-tool surface',
    JSON.stringify(names) ===
      JSON.stringify(['run_javascript', 'docs', 'open', 'screenshot']),
    names,
  )

  const guide = await mcp.call('docs', { topic: 'live-model' })
  check(
    'docs live-model carries the renaming contract',
    Boolean(guide?.text?.includes('renameRegionsIfNeeded')),
  )

  async function run(code: string) {
    return mcp.callJson('run_javascript', { code })
  }

  const loaded = await run(`
    return jb.loadSessionSpec({
      sessionName: 'MCP conformance',
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-30,000',
          tracks: [
            { trackId: 'gff3tabix_genes', height: 140 },
            { trackId: 'volvox_test_vcf', height: 100 },
          ],
        },
      ],
    })`)
  check('spec load settles', loaded.value?.settled === true, loaded)
  check(
    'spec load shows both tracks',
    loaded.value?.session?.views?.[0]?.tracks?.length === 2,
    loaded.value?.session,
  )

  const navigated = await run(`
    const view = session.views[0]
    const moved = await view.navToLocString('Apple3')
    const settle = await jb.waitReady(30000)
    return { moved: moved !== false, ...settle, visible: view.visibleLocStrings }`)
  check(
    'gene-name navigation lands on a region',
    navigated.value?.moved === true &&
      typeof navigated.value?.visible === 'string' &&
      navigated.value.visible.includes(':'),
    navigated,
  )

  const updated = await run(`
    const results = session.views
      .flatMap(v => v.tracks ?? [])
      .map(t => t.applyDisplaySettings({ displayMode: 'compact' }))
    const settle = await jb.waitReady(30000)
    return { results, ...settle }`)
  check(
    'the track model action makes every shown track compact',
    updated.value?.results?.length === 2 &&
      updated.value.results.every((r: { applied?: string[] }) =>
        r.applied?.includes('displayMode'),
      ),
    updated,
  )

  const inspected = await run(`return jb.inspect('views.0.visibleLocStrings')`)
  check(
    'inspect reads a live getter',
    typeof inspected.value?.value === 'string' &&
      inspected.value.value.includes(':'),
    inspected,
  )

  const summary = await run('return jb.sessionSummary()')
  check(
    'sessionSummary lists the view',
    summary.value?.views?.length === 1,
    summary,
  )

  const required = await run(`
    const util = jb.require('@jbrowse/core/util')
    return {
      sameParse: util.parseLocString === jb.parseLocString,
      catalog: jb.listTracks().total,
      vcfListed: jb.listTracks('volvox_test_vcf').total,
    }`)
  check(
    'jb.require serves the plugin ABI registry',
    required.value?.sameParse === true,
    required,
  )
  check(
    'listTracks reads the full catalog',
    required.value?.catalog > 10 && required.value?.vcfListed >= 1,
    required,
  )

  const variants = await run(`
    const feats = await jb.getFeatures({
      trackId: 'volvox_test_vcf',
      loc: 'ctgA:1-30,000',
    })
    globalThis.mcpConformanceCount = feats.length
    return {
      variants: feats.length,
      displayModeSlot:
        'displayMode' in
        jb.describeSlots(jb.trackModel('gff3tabix_genes').activeDisplay.configuration),
    }`)
  check(
    'getFeatures renames refNames (contigA file answers ctgA query)',
    variants.value?.variants > 0,
    variants,
  )
  check(
    'describeSlots names displayMode',
    variants.value?.displayModeSlot === true,
    variants,
  )
  const persisted = await run('return globalThis.mcpConformanceCount')
  check(
    'globalThis persists between run_javascript calls',
    persisted.value === variants.value?.variants,
    persisted,
  )

  const genes = await run(`
    const feats = await jb.getFeatures({ trackId: 'gff3tabix_genes' })
    return { visibleRegionFeatures: feats.length }`)
  check(
    'getFeatures defaults to the visible region',
    genes.value?.visibleRegionFeatures > 0,
    genes,
  )

  const hidden = await run(`
    const view = session.views[0]
    return { hidden: view.hideTrack('volvox_test_vcf') }`)
  check('hideTrack removes the track', hidden.value?.hidden >= 1, hidden)

  const shot = await mcp.call('screenshot', {})
  check(
    'screenshot returns a real image',
    shot?.type === 'image' && (shot.data?.length ?? 0) > 20_000,
    shot?.type,
  )

  const recent = await mcp.callJson('open')
  check('bare open lists recent sessions', Array.isArray(recent), recent)

  const reopened = await mcp.callJson('open', { target: volvoxConfig })
  check(
    'open waits for the new session before answering',
    reopened.opened === volvoxConfig && reopened.note === undefined,
    reopened,
  )
  const fresh = await run('return jb.sessionSummary()')
  check(
    'the session after open is the reopened config',
    Array.isArray(fresh.value?.assemblyNames) &&
      fresh.value.assemblyNames.includes('volvox'),
    fresh,
  )

  mcp.stop()
  console.log(process.exitCode ? 'FAILED' : 'PASSED')
} finally {
  app?.kill()
  rendererServer?.close()
}
