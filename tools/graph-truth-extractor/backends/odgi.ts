import fs from 'fs'
import path from 'path'

import { getCacheDir, makeRegionString, runCommand, which } from './util.ts'

import type { ExtractRequest, ExtractResult } from './types.ts'

let odgiVersionCache: string | undefined

function findOdgi(): string | undefined {
  const fromPath = which('odgi')
  if (fromPath) {
    return fromPath
  }
  const home = process.env.HOME ?? ''
  const vendor = path.join(home, 'src/vendor/odgi/bin/odgi')
  if (fs.existsSync(vendor)) {
    return vendor
  }
  return undefined
}

async function getOdgiVersion(odgiBin: string): Promise<string> {
  if (odgiVersionCache) {
    return odgiVersionCache
  }
  try {
    const { stdout } = await runCommand(odgiBin, ['version'])
    odgiVersionCache = (stdout.split('\n')[0] ?? '').trim()
  } catch {
    odgiVersionCache = 'unknown'
  }
  return odgiVersionCache
}

async function ensureOg(
  gfaPath: string,
  cacheDir: string,
  odgiBin: string,
): Promise<string> {
  const base = path.basename(gfaPath)
  const ogPath = path.join(cacheDir, `${base}.og`)
  if (fs.existsSync(ogPath)) {
    return ogPath
  }
  const tmp = `${ogPath}.tmp`
  await runCommand(odgiBin, ['build', '-g', gfaPath, '-o', tmp])
  fs.renameSync(tmp, ogPath)
  return ogPath
}

export async function odgiBackend(req: ExtractRequest): Promise<ExtractResult> {
  const odgiBin = findOdgi()
  if (!odgiBin) {
    throw new Error(
      'odgi not found on PATH or ~/src/vendor/odgi/bin — build odgi or set $PATH',
    )
  }
  const cacheDir = getCacheDir(req.gfaPath, req.cacheDir)
  const ogPath = await ensureOg(req.gfaPath, cacheDir, odgiBin)
  const region = makeRegionString(req.pathName, req.start, req.end)
  const ctx = req.context === 'snarl' ? 1 : req.context

  const t0 = Date.now()
  const subOg = path.join(
    cacheDir,
    `extract-${req.pathName.replace(/[^A-Za-z0-9]/g, '_')}-${req.start}-${req.end}-c${ctx}.og`,
  )
  await runCommand(odgiBin, [
    'extract',
    '-i',
    ogPath,
    '-r',
    region,
    '-c',
    String(ctx),
    '-o',
    subOg,
  ])
  const { stdout: gfa } = await runCommand(odgiBin, ['view', '-i', subOg, '-g'])
  fs.unlinkSync(subOg)
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
    backendVersion: await getOdgiVersion(odgiBin),
    notes: `odgi extract -r ${region} -c ${ctx}`,
  }
}
