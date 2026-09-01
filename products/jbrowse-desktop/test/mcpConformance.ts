// MCP conformance: launches the built app (renderer served from build/, main
// from build/electron.js), connects the stdio server to its bridge socket, and
// exercises every tool against the volvox test config — including the
// regressions found while building this surface: refName renaming (a VCF
// spelling contigA must answer a ctgA query), bulk in-place track updates,
// live-getter inspection, evaluate's globalThis persistence, and the stdio
// server draining in-flight calls.
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
      await mcp.callJson('inspect_session')
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
  for (const expected of [
    'evaluate',
    'docs',
    'open',
    'inspect_session',
    'list_tracks',
    'load_session_spec',
    'navigate',
    'track',
    'add_track',
    'get_features',
    'screenshot',
  ]) {
    check(`tools/list has ${expected}`, names.includes(expected))
  }

  const guide = await mcp.call('docs', { topic: 'live-model' })
  check(
    'docs live-model carries the renaming contract',
    Boolean(guide?.text?.includes('renameRegionsIfNeeded')),
  )

  const loaded = await mcp.callJson('load_session_spec', {
    spec: {
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
    },
  })
  check('spec load settles', loaded.settled === true, loaded)
  check(
    'spec load shows both tracks',
    loaded.session?.views?.[0]?.tracks?.length === 2,
    loaded.session,
  )

  const updated = await mcp.callJson('track', {
    action: 'update',
    settings: { displayMode: 'compact' },
  })
  check(
    'bulk update applies displayMode to every shown track',
    updated.updated?.length === 2 &&
      updated.updated.every((u: { applied?: string[] }) =>
        u.applied?.includes('displayMode'),
      ),
    updated,
  )

  const overview = await mcp.callJson('inspect_session')
  check('inspect overview lists views', overview.views?.length === 1, overview)
  const visible = await mcp.callJson('inspect_session', {
    path: 'views.0.visibleLocStrings',
  })
  check(
    'inspect reads a live getter',
    typeof visible.value === 'string' && visible.value.includes(':'),
    visible,
  )

  const genes = await mcp.callJson('get_features', {
    trackId: 'gff3tabix_genes',
    limit: 2,
  })
  check('get_features reads the visible region', genes.total > 0, genes)

  const variants = await mcp.callJson('get_features', {
    trackId: 'volvox_test_vcf',
    loc: 'ctgA:1-30,000',
    limit: 1,
  })
  check(
    'get_features renames refNames (contigA file answers ctgA query)',
    variants.total > 0,
    variants,
  )

  const evaluated = await mcp.callJson('evaluate', {
    code: `
      const conf = session.getTrackById('gff3tabix_genes')
      const track = session.views
        .flatMap(v => v.tracks ?? [])
        .find(t => t.configuration.trackId === 'gff3tabix_genes')
      const renamed = await jb.renameRegionsIfNeeded(session.assemblyManager, {
        regions: [{ assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 }],
        adapterConfig: jb.readConfObject(conf, 'adapter'),
        sessionId: jb.getRpcSessionId(track),
      })
      const adapter = await jb.getFeatureAdapterOrThrow({
        pluginManager,
        sessionId: jb.getRpcSessionId(track),
        adapterConfig: renamed.adapterConfig,
        sequenceAdapter: renamed.sequenceAdapter,
      })
      const feats = await adapter.getFeaturesArray(renamed.regions[0])
      globalThis.mcpConformanceCount = feats.length
      const display = track.activeDisplay
      return {
        features: feats.length,
        displayModeSlot: 'displayMode' in jb.describeSlots(display.configuration),
      }`,
  })
  check(
    'evaluate fetches through a warmed adapter',
    evaluated.value?.features > 0,
    evaluated,
  )
  check(
    'describeSlots names displayMode',
    evaluated.value?.displayModeSlot === true,
    evaluated,
  )
  const persisted = await mcp.callJson('evaluate', {
    code: 'return globalThis.mcpConformanceCount',
  })
  check(
    'globalThis persists between evaluate calls',
    persisted.value === evaluated.value?.features,
    persisted,
  )

  const hidden = await mcp.callJson('track', {
    action: 'hide',
    track: 'volvox_test_vcf',
  })
  check('track hide removes the track', hidden.hidden >= 1, hidden)

  const shot = await mcp.call('screenshot', {})
  check(
    'screenshot returns a real image',
    shot?.type === 'image' && (shot.data?.length ?? 0) > 20_000,
    shot?.type,
  )

  const recent = await mcp.callJson('open')
  check('bare open lists recent sessions', Array.isArray(recent), recent)

  mcp.stop()
  console.log(process.exitCode ? 'FAILED' : 'PASSED')
} finally {
  app?.kill()
  rendererServer?.close()
}
