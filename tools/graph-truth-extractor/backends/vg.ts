import fs from 'fs'
import path from 'path'

import {
  getCacheDir,
  makeRegionString,
  runCommand,
  runCommandBinary,
  which,
} from './util.ts'

import type { ExtractRequest, ExtractResult } from './types.ts'

let vgVersionCache: string | undefined

async function getVgVersion(): Promise<string> {
  if (vgVersionCache) {
    return vgVersionCache
  }
  const { stdout } = await runCommand('vg', ['version'])
  const firstLine = stdout.split('\n')[0] ?? ''
  vgVersionCache = firstLine.trim()
  return vgVersionCache
}

// vg's PanSN path handling rewrites 3-field GFA P-line names like
// `ref#0#ctgA` into 4-field walk-style names with an offset, e.g.
// `ref#0#ctgA#0`. We translate the caller's name by listing the index
// and picking the (longest) match — preserves correctness when the index
// kept the original 3-field form, and falls back to the rewritten form
// otherwise.
const xgPathListCache = new Map<string, string[]>()
async function listVgPaths(xgPath: string): Promise<string[]> {
  const cached = xgPathListCache.get(xgPath)
  if (cached) {
    return cached
  }
  const { stdout } = await runCommand('vg', ['find', '-I', '-x', xgPath])
  const paths = stdout
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
  xgPathListCache.set(xgPath, paths)
  return paths
}
async function resolveVgPathName(
  xgPath: string,
  requested: string,
): Promise<string> {
  const paths = await listVgPaths(xgPath)
  if (paths.includes(requested)) {
    return requested
  }
  const candidates = paths.filter(p => p.startsWith(requested + '#'))
  if (candidates.length === 1) {
    return candidates[0]!
  }
  if (candidates.length > 1) {
    // Prefer the offset-0 fragment when multiple variants exist.
    const zero = candidates.find(p => p === requested + '#0')
    if (zero) {
      return zero
    }
    return candidates[0]!
  }
  throw new Error(
    `Path ${requested} not found in vg index (have ${paths.length} paths; first 5: ${paths.slice(0, 5).join(', ')})`,
  )
}

async function ensureXg(gfaPath: string, cacheDir: string): Promise<string> {
  const base = path.basename(gfaPath)
  const xgPath = path.join(cacheDir, `${base}.xg`)
  if (fs.existsSync(xgPath)) {
    return xgPath
  }
  const tmp = `${xgPath}.tmp`
  // vg convert -g <gfa> -x emits xg-format binary on stdout — capture as
  // Buffer (utf8 round-tripping mangles non-ASCII bytes in the index).
  const { stdout } = await runCommandBinary('vg', [
    'convert',
    '-g',
    gfaPath,
    '-x',
  ])
  fs.writeFileSync(tmp, stdout)
  fs.renameSync(tmp, xgPath)
  return xgPath
}

export async function vgFindBackend(
  req: ExtractRequest,
): Promise<ExtractResult> {
  if (!which('vg')) {
    throw new Error(
      'vg not found on PATH — install vg ≥ 1.59.0 or skip this backend',
    )
  }
  const cacheDir = getCacheDir(req.gfaPath, req.cacheDir)
  const xgPath = await ensureXg(req.gfaPath, cacheDir)
  const resolvedPath = await resolveVgPathName(xgPath, req.pathName)
  const region = makeRegionString(resolvedPath, req.start, req.end)
  const ctx = req.context === 'snarl' ? 1 : req.context

  const t0 = Date.now()
  // `vg find -p PATH:start-end -c k -x graph.xg` writes a vg protobuf
  // subgraph on stdout. Pipe through `vg view -g -` to get GFA.
  const { stdout: vgBin } = await runCommandBinary('vg', [
    'find',
    '-p',
    region,
    '-c',
    String(ctx),
    '-x',
    xgPath,
  ])
  const { stdout: gfa } = await runCommand('vg', ['view', '-g', '-'], {
    input: vgBin,
  })
  const elapsedMs = Date.now() - t0

  let segCount = 0
  let edgeCount = 0
  let pathCount = 0
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      segCount++
    } else if (line.startsWith('L\t')) {
      edgeCount++
    } else if (line.startsWith('P\t') || line.startsWith('W\t')) {
      pathCount++
    }
  }

  return {
    gfa,
    segmentCount: segCount,
    edgeCount: edgeCount,
    pathCount: pathCount,
    elapsedMs,
    backendVersion: await getVgVersion(),
    notes: `vg find -p ${region} -c ${ctx} -x ${xgPath}`,
  }
}
