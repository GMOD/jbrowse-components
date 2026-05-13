import fs from 'fs'

import { findBinary, parsePathTable, runProcess } from './odgi.ts'

export function findVg(): string {
  return findBinary({
    envVar: 'VG',
    name: 'vg',
    homeFallback: '.local/bin/vg',
  })
}

// .xg is the indexed format optimized for path-range random access. Building
// from .vg or .gfa is a one-time cost (~90s for chr20). The on-disk format is
// memory-mappable and succinct, so per-call deserialize is ~constant in graph
// size — that's the win vs odgi's .og (full deserialize per invocation).
export async function ensureXg(graphFile: string, vgBin: string) {
  if (graphFile.endsWith('.xg') && fs.existsSync(graphFile)) {
    return graphFile
  }
  if (
    graphFile.endsWith('.vg') ||
    graphFile.endsWith('.gfa') ||
    graphFile.endsWith('.gfa.gz') ||
    graphFile.endsWith('.pg') ||
    graphFile.endsWith('.hg')
  ) {
    const xgPath = `${graphFile}.xg`
    if (fs.existsSync(xgPath)) {
      return xgPath
    }
    const tmp = `${xgPath}.tmp`
    console.log(`[graph-server] vg convert -x ${graphFile} > ${xgPath}`)
    const t0 = Date.now()
    const r = await runProcess(vgBin, ['convert', '-x', graphFile])
    fs.writeFileSync(tmp, r.stdout)
    fs.renameSync(tmp, xgPath)
    console.log(`[graph-server] built ${xgPath} in ${Date.now() - t0}ms`)
    return xgPath
  }
  throw new Error(`Unsupported graph file for vg backend: ${graphFile}`)
}

export async function vgPathsList(vgBin: string, xgPath: string) {
  const t0 = Date.now()
  const res = await runProcess(vgBin, ['paths', '-x', xgPath, '-E'])
  return { ...parsePathTable(res.stdout, 1), ms: Date.now() - t0 }
}

export async function vgExtract({
  vgBin,
  xgPath,
  region,
  context,
}: {
  vgBin: string
  xgPath: string
  region: string
  context: number
}) {
  const t0 = Date.now()
  // `vg find -p <region> -c <steps>` emits a subgraph in vg's protobuf format;
  // piping to `vg view -g` converts to GFA text. We invoke them sequentially
  // because Node child_process pipes are awkward when both producer and
  // consumer are spawn() calls — just stage the protobuf in memory (subgraphs
  // are small for the regions we care about: 10kb extract ≈ 330KB).
  const findRes = await runProcess(vgBin, [
    'find',
    '-x',
    xgPath,
    '-p',
    region,
    '-c',
    String(context),
  ])
  const tExtract = findRes.ms
  const viewRes = await runProcess(vgBin, ['view', '-g', '-'], {
    input: findRes.stdout,
  })
  return {
    gfa: viewRes.stdout.toString('utf8'),
    ms: Date.now() - t0,
    extractMs: tExtract,
    viewMs: viewRes.ms,
  }
}
