import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { convertWLinesToPLines } from './wToP.ts'

import type { SpawnOptions } from 'child_process'

interface RunOpts extends SpawnOptions {
  input?: Buffer
}

interface RunResult {
  stdout: Buffer
  stderr: string
  code: number | null
  ms: number
}

export function runProcess(
  cmd: string,
  args: string[],
  opts: RunOpts = {},
): Promise<RunResult> {
  const { input, ...spawnOpts } = opts
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      ...spawnOpts,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const chunks: Buffer[] = []
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => {
      chunks.push(d)
    })
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8')
    })
    proc.on('error', err => {
      reject(err)
    })
    proc.on('close', code => {
      const ms = Date.now() - t0
      if (code !== 0) {
        reject(
          new Error(
            `${cmd} ${args.join(' ')} exited ${code}\nstderr:\n${stderr}`,
          ),
        )
      } else {
        resolve({ stdout: Buffer.concat(chunks), stderr, code, ms })
      }
    })
    if (input) {
      proc.stdin.end(input)
    } else {
      proc.stdin.end()
    }
  })
}

// env var → ~ fallback → PATH walk. Throws if nothing resolves.
export function findBinary(opts: {
  envVar: string
  name: string
  homeFallback: string
}): string {
  const fromEnv = process.env[opts.envVar]
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv
  }
  const fallback = path.join(process.env.HOME ?? '', opts.homeFallback)
  if (fs.existsSync(fallback)) {
    return fallback
  }
  for (const p of (process.env.PATH ?? '').split(path.delimiter)) {
    const full = path.join(p, opts.name)
    if (fs.existsSync(full)) {
      return full
    }
  }
  throw new Error(
    `${opts.name} binary not found. Set ${opts.envVar} env var or install at ~/${opts.homeFallback}`,
  )
}

export function findOdgi(): string {
  return findBinary({
    envVar: 'ODGI',
    name: 'odgi',
    homeFallback: 'src/vendor/odgi/bin/odgi',
  })
}

export async function ensureOg(graphFile: string, odgiBin: string) {
  if (graphFile.endsWith('.og') && fs.existsSync(graphFile)) {
    if (await ogHasPaths(graphFile, odgiBin)) {
      return graphFile
    }
    throw new Error(
      `${graphFile} has zero paths — likely built from a W-line GFA with old odgi. Delete it and point at the source .gfa instead so the server can convert W→P first.`,
    )
  }
  if (graphFile.endsWith('.gfa') || graphFile.endsWith('.gfa.gz')) {
    const ogPath = `${graphFile}.og`
    if (fs.existsSync(ogPath) && (await ogHasPaths(ogPath, odgiBin))) {
      return ogPath
    }
    if (fs.existsSync(ogPath)) {
      console.warn(
        `[graph-server] ${ogPath} has zero paths — assuming source is W-line GFA and rebuilding`,
      )
      fs.unlinkSync(ogPath)
    }
    const built = await buildOgFrom(graphFile, ogPath, odgiBin)
    if (await ogHasPaths(built, odgiBin)) {
      return built
    }
    // Build emitted no paths — odgi v0.9.4 silently drops W-lines.
    // Convert and rebuild from the W→P version.
    console.warn(
      `[graph-server] ${built} has zero paths after build; converting W→P and rebuilding`,
    )
    fs.unlinkSync(built)
    const converted = await convertGfaWtoP(graphFile)
    return buildOgFrom(converted, ogPath, odgiBin)
  }
  throw new Error(`Unsupported graph file: ${graphFile}`)
}

async function buildOgFrom(sourceGfa: string, ogPath: string, odgiBin: string) {
  const tmp = `${ogPath}.tmp`
  // -O optimizes (compacts node ID space — required by odgi extract);
  // -s topologically sorts so subgraphs cover contiguous ID ranges.
  // Skipping these makes extract fail with "node IDs are not compacted".
  console.log(`[graph-server] odgi build -g ${sourceGfa} -O -s -o ${ogPath}`)
  const t0 = Date.now()
  await runProcess(odgiBin, ['build', '-g', sourceGfa, '-O', '-s', '-o', tmp])
  fs.renameSync(tmp, ogPath)
  console.log(`[graph-server] built ${ogPath} in ${Date.now() - t0}ms`)
  return ogPath
}

async function convertGfaWtoP(gfaPath: string): Promise<string> {
  const out = `${gfaPath}.with-p.gfa`
  if (fs.existsSync(out)) {
    return out
  }
  const tmp = `${out}.tmp`
  console.log(`[graph-server] converting W→P: ${gfaPath} → ${out}`)
  const t0 = Date.now()
  const stats = await convertWLinesToPLines(gfaPath, tmp)
  fs.renameSync(tmp, out)
  console.log(
    `[graph-server] W→P done in ${Date.now() - t0}ms: ${stats.wCount} W converted, ${stats.pCount} P preserved`,
  )
  return out
}

async function ogHasPaths(ogPath: string, odgiBin: string) {
  const r = await runProcess(odgiBin, ['paths', '-i', ogPath, '-L'])
  return r.stdout.length > 0
}

export async function odgiExtract({
  odgiBin,
  ogPath,
  region,
  context,
  threads,
}: {
  odgiBin: string
  ogPath: string
  region: string
  context: number
  threads?: number
}) {
  const t0 = Date.now()
  const subOg = `/tmp/graph-server-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.og`
  // `odgi extract` parallelizes well on large graphs (HPRC chr20 1.13 GB .og:
  // 47s single-threaded → 8s with -t 16 on a 16-core box). Empirical default
  // = number of logical CPUs; override per call via `threads`.
  const t = threads ?? os.availableParallelism()
  try {
    const extractRes = await runProcess(odgiBin, [
      'extract',
      '-i',
      ogPath,
      '-r',
      region,
      '-c',
      String(context),
      '-t',
      String(t),
      '-o',
      subOg,
    ])
    const viewRes = await runProcess(odgiBin, ['view', '-i', subOg, '-g'])
    return {
      gfa: viewRes.stdout.toString('utf8'),
      ms: Date.now() - t0,
      extractMs: extractRes.ms,
      viewMs: viewRes.ms,
    }
  } finally {
    if (fs.existsSync(subOg)) {
      fs.unlinkSync(subOg)
    }
  }
}

// Parse `name\t...\t<length>` rows where the length is at column `lenCol`.
// odgi emits `name\tstart\tend` from `paths -Ll` (lenCol=2); vg emits
// `name\tlength` from `paths -E` (lenCol=1).
export function parsePathTable(stdout: Buffer, lenCol: number) {
  const names: string[] = []
  const lengths = new Map<string, number>()
  for (const line of stdout.toString('utf8').split('\n')) {
    if (!line) {
      continue
    }
    const cols = line.split('\t')
    if (cols.length <= lenCol) {
      continue
    }
    const name = cols[0]!
    names.push(name)
    const len = Number(cols[lenCol])
    if (Number.isFinite(len)) {
      lengths.set(name, len)
    }
  }
  return { names, lengths }
}

export async function odgiPathsList(odgiBin: string, ogPath: string) {
  const t0 = Date.now()
  const res = await runProcess(odgiBin, ['paths', '-i', ogPath, '-Ll'])
  return { ...parsePathTable(res.stdout, 2), ms: Date.now() - t0 }
}
