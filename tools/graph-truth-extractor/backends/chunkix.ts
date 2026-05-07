import fs from 'fs'
import path from 'path'

import { getCacheDir, makeRegionString, runCommand, which } from './util.ts'

import type { ExtractRequest, ExtractResult } from './types.ts'

let chunkixVersionCache: string | undefined

async function getChunkixVersion(stmDir: string): Promise<string> {
  if (chunkixVersionCache) {
    return chunkixVersionCache
  }
  try {
    const { stdout } = await runCommand('git', [
      '-C',
      stmDir,
      'rev-parse',
      '--short',
      'HEAD',
    ])
    chunkixVersionCache = `chunkix@${stdout.trim()}`
  } catch {
    chunkixVersionCache = 'chunkix@unknown'
  }
  return chunkixVersionCache
}

function findSequenceTubeMapDir(): string | undefined {
  // Allow override via env, otherwise look for the canonical location
  // documented in the plan (~/src/sequencetubemap).
  const envPath = process.env.SEQUENCETUBEMAP_DIR
  if (envPath && fs.existsSync(path.join(envPath, 'scripts/chunkix.py'))) {
    return envPath
  }
  const home = process.env.HOME ?? ''
  for (const candidate of [
    path.join(home, 'src/vendor/sequenceTubeMap'),
    path.join(home, 'src/sequencetubemap'),
    path.join(home, 'src/sequenceTubeMap'),
  ]) {
    if (fs.existsSync(path.join(candidate, 'scripts/chunkix.py'))) {
      return candidate
    }
  }
  return undefined
}

async function ensurePgtabixIndex(
  gfaPath: string,
  cacheDir: string,
  stmDir: string,
): Promise<string> {
  const base = path.basename(gfaPath)
  const prefix = path.join(cacheDir, `chunkix-${base}`)
  if (
    fs.existsSync(`${prefix}.pos.bed.gz`) &&
    fs.existsSync(`${prefix}.nodes.tsv.gz`) &&
    fs.existsSync(`${prefix}.haps.gaf.gz`)
  ) {
    return prefix
  }
  const pgtabix = path.join(stmDir, 'scripts/pgtabix.py')
  await runCommand('python3', [pgtabix, '-g', gfaPath, '-o', prefix])
  return prefix
}

export async function chunkixBackend(
  req: ExtractRequest,
): Promise<ExtractResult> {
  if (!which('python3')) {
    throw new Error('python3 not found on PATH — required for chunkix backend')
  }
  if (!which('tabix') || !which('bgzip')) {
    throw new Error(
      'tabix/bgzip not found on PATH — required for chunkix backend',
    )
  }
  const stmDir = findSequenceTubeMapDir()
  if (!stmDir) {
    throw new Error(
      'sequencetubemap checkout not found — set $SEQUENCETUBEMAP_DIR or clone to ~/src/sequencetubemap',
    )
  }
  const cacheDir = getCacheDir(req.gfaPath, req.cacheDir)
  const prefix =
    req.indexPrefix ?? (await ensurePgtabixIndex(req.gfaPath, cacheDir, stmDir))
  const region = makeRegionString(req.pathName, req.start, req.end)

  const outDir = fs.mkdtempSync(path.join(cacheDir, 'chunkix-run-'))
  const outPrefix = path.join(outDir, 'chunk')

  const t0 = Date.now()
  try {
    const chunkix = path.join(stmDir, 'scripts/chunkix.py')
    await runCommand('python3', [
      chunkix,
      '-n',
      `${prefix}.nodes.tsv.gz`,
      '-p',
      `${prefix}.pos.bed.gz`,
      '-g',
      `${prefix}.haps.gaf.gz`,
      '-r',
      region,
      '-o',
      outPrefix,
    ])
    const gfa = fs.readFileSync(`${outPrefix}.gfa`, 'utf8')
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
      backendVersion: await getChunkixVersion(stmDir),
      notes: `chunkix.py -r ${region} prefix=${prefix}`,
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true })
  }
}
