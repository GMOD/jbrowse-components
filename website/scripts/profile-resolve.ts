// Throwaway: turn a CDP .cpuprofile into self-time tables attributed to real
// source files, resolving minified frames through the build's *.js.map.
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
// source-map isn't a direct workspace dep; 0.6.1 is in the store (sync API).
const { SourceMapConsumer } = require(
  path.join(
    path.resolve(import.meta.dirname, '..', '..'),
    'node_modules/.pnpm/source-map@0.6.1/node_modules/source-map',
  ),
) as {
  SourceMapConsumer: new (raw: unknown) => {
    originalPositionFor(pos: { line: number; column: number }): {
      source: string | null
      line: number | null
      name: string | null
    }
  }
}

interface CallFrame {
  functionName: string
  url: string
  lineNumber: number
  columnNumber: number
}

interface CpuProfile {
  nodes: { id: number; callFrame: CallFrame; children?: number[] }[]
  startTime: number
  endTime: number
  samples?: number[]
  timeDeltas?: number[]
}

export interface ProfileSummary {
  totalMs: number
  idleMs: number
  gcMs: number
  busyMs: number
  functions: { name: string; where: string; selfMs: number }[]
  files: { file: string; selfMs: number }[]
  packages: { pkg: string; selfMs: number }[]
}

type Consumer = InstanceType<typeof SourceMapConsumer>

const consumers = new Map<string, Consumer | undefined>()

function consumerFor(url: string, buildJsDir: string) {
  const base = path.basename(new URL(url, 'http://x').pathname)
  if (!consumers.has(base)) {
    const mapPath = path.join(buildJsDir, `${base}.map`)
    consumers.set(
      base,
      fs.existsSync(mapPath)
        ? new SourceMapConsumer(
            JSON.parse(fs.readFileSync(mapPath, 'utf8')) as unknown,
          )
        : undefined,
    )
  }
  return consumers.get(base)
}

// webpack://@jbrowse/web/../../plugins/alignments/src/x.ts -> plugins/alignments/src/x.ts
function cleanSource(source: string) {
  const stripped = source
    .replace(/^webpack:\/\//, '')
    .replace(/^[^/]*\//, '')
    .replace(/(\.\.\/)+/g, '')
  return stripped.startsWith('node_modules')
    ? stripped
    : stripped.replace(/^\.\//, '')
}

// Bucket a source path into the unit an optimization decision is made at:
// a workspace package/plugin, or a third-party dependency.
function packageOf(file: string) {
  const nm = file.lastIndexOf('node_modules/')
  if (nm !== -1) {
    const rest = file.slice(nm + 'node_modules/'.length).split('/')
    return `node_modules/${rest[0]?.startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]}`
  }
  const parts = file.split('/')
  if (
    parts[0] === 'plugins' ||
    parts[0] === 'packages' ||
    parts[0] === 'products'
  ) {
    return `${parts[0]}/${parts[1]}`
  }
  return parts[0] ?? file
}

export function aggregateProfile(
  profile: CpuProfile,
  buildJsDir: string,
): ProfileSummary {
  const byId = new Map(profile.nodes.map(n => [n.id, n]))
  const selfByNode = new Map<number, number>()
  const samples = profile.samples ?? []
  const deltas = profile.timeDeltas ?? []
  for (let i = 0; i < samples.length; i++) {
    const id = samples[i]!
    // timeDeltas[i] is the gap BEFORE sample i; attribute it to sample i-1's
    // node, which is what was running during that gap.
    const dt = deltas[i] ?? 0
    const owner = i > 0 ? samples[i - 1]! : id
    selfByNode.set(owner, (selfByNode.get(owner) ?? 0) + dt)
  }

  const fnTotals = new Map<
    string,
    { name: string; where: string; selfMs: number }
  >()
  const fileTotals = new Map<string, number>()
  const pkgTotals = new Map<string, number>()
  let idleUs = 0
  let gcUs = 0
  let totalUs = 0

  for (const [nodeId, us] of selfByNode) {
    totalUs += us
    const node = byId.get(nodeId)
    if (!node) {
      continue
    }
    const { functionName, url, lineNumber, columnNumber } = node.callFrame
    if (functionName === '(idle)' || functionName === '(program)') {
      idleUs += us
      continue
    }
    if (functionName === '(garbage collector)') {
      gcUs += us
      continue
    }
    let name = functionName || '(anonymous)'
    let file = url ? path.basename(url) : '(native)'
    let line = lineNumber + 1
    // synthetic frames ((root), wasm, injected) carry lineNumber -1, which the
    // sourcemap consumer rejects outright
    if (url.includes('/static/js/') && lineNumber >= 0) {
      const consumer = consumerFor(url, buildJsDir)
      const pos = consumer?.originalPositionFor({
        line: lineNumber + 1,
        column: columnNumber,
      })
      if (pos?.source) {
        file = cleanSource(pos.source)
        line = pos.line ?? 0
        name = pos.name ?? name
      }
    }
    const where = `${file}:${line}`
    const key = `${name}|${where}`
    const prev = fnTotals.get(key)
    fnTotals.set(key, { name, where, selfMs: (prev?.selfMs ?? 0) + us / 1000 })
    fileTotals.set(file, (fileTotals.get(file) ?? 0) + us / 1000)
    const pkg = packageOf(file)
    pkgTotals.set(pkg, (pkgTotals.get(pkg) ?? 0) + us / 1000)
  }

  const sortDesc = <T>(
    m: Map<string, number>,
    make: (k: string, v: number) => T,
  ) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => make(k, v))

  return {
    totalMs: totalUs / 1000,
    idleMs: idleUs / 1000,
    gcMs: gcUs / 1000,
    busyMs: (totalUs - idleUs) / 1000,
    functions: [...fnTotals.values()].sort((a, b) => b.selfMs - a.selfMs),
    files: sortDesc(fileTotals, (file, selfMs) => ({ file, selfMs })),
    packages: sortDesc(pkgTotals, (pkg, selfMs) => ({ pkg, selfMs })),
  }
}

const ms = (n: number) => `${n.toFixed(0)} ms`

export function renderTable(s: ProfileSummary, top = 20) {
  return [
    `wall ${ms(s.totalMs)} · busy ${ms(s.busyMs)} (${((100 * s.busyMs) / Math.max(1, s.totalMs)).toFixed(0)}%) · GC ${ms(s.gcMs)}`,
    '',
    '| self | package |',
    '| --- | --- |',
    ...s.packages.slice(0, 12).map(p => `| ${ms(p.selfMs)} | ${p.pkg} |`),
    '',
    '| self | function | source |',
    '| --- | --- | --- |',
    ...s.functions
      .slice(0, top)
      .map(f => `| ${ms(f.selfMs)} | \`${f.name}\` | ${f.where} |`),
  ].join('\n')
}
