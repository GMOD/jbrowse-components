import fs from 'fs'

import { ensureOg, findOdgi, odgiPathsList } from './odgi.ts'
import { ensureXg, findVg, vgPathsList } from './vg.ts'

export type Backend = 'odgi' | 'vg'

interface DatasetConfigEntry {
  id: string
  graph: string
  backend?: Backend
}

interface DatasetsConfig {
  datasets: DatasetConfigEntry[]
}

export interface PathInfo {
  // Full odgi path name, e.g. "CHM13#0#chr20:100864-26386516"
  name: string
  // Path length in bp (== subwalkEnd - subwalkStart for W-line subwalks)
  length: number
  // PanSN-extracted genome ("CHM13#0")
  genome: string
  // Logical chromosome name without subwalk offset ("chr20")
  refName: string
  // Subwalk start in genomic coords (0 for non-subwalk P-lines).
  subwalkStart: number
  // Subwalk end in genomic coords (== subwalkStart + length for subwalks).
  subwalkEnd: number
}

export interface DatasetSetup {
  id: string
  // `.og` (odgi backend) or `.xg` (vg backend) - the deserialized index file
  // path passed to extract calls.
  indexPath: string
  backend: Backend
  graphFile: string
  paths: PathInfo[]
}

export class DatasetRegistry {
  readonly odgiBin: string
  // vg is optional - resolved lazily on first vg-backed dataset access so
  // odgi-only deployments don't fail if vg isn't installed.
  private vgBinCached: string | undefined
  private readonly entries: Map<string, DatasetConfigEntry>
  private readonly setupCache = new Map<string, Promise<DatasetSetup>>()

  constructor(configPath: string) {
    this.odgiBin = findOdgi()
    if (!fs.existsSync(configPath)) {
      throw new Error(`datasets config not found: ${configPath}`)
    }
    const raw = JSON.parse(
      fs.readFileSync(configPath, 'utf8'),
    ) as DatasetsConfig
    if (!Array.isArray(raw.datasets) || raw.datasets.length === 0) {
      throw new Error(`datasets config has no datasets[]: ${configPath}`)
    }
    this.entries = new Map(raw.datasets.map(d => [d.id, d]))
    console.log(
      `[graph-server] loaded ${this.entries.size} datasets from ${configPath}`,
    )
    for (const [id, e] of this.entries) {
      console.log(`  - ${id}: ${e.graph}`)
    }
  }

  list(): { id: string; graph: string }[] {
    return [...this.entries.values()].map(e => ({ id: e.id, graph: e.graph }))
  }

  has(id: string) {
    return this.entries.has(id)
  }

  async getSetup(id: string): Promise<DatasetSetup> {
    const entry = this.entries.get(id)
    if (!entry) {
      throw new Error(`unknown dataset id: ${id}`)
    }
    let p = this.setupCache.get(id)
    if (!p) {
      p = this.buildSetup(entry).catch(err => {
        this.setupCache.delete(id)
        throw err
      })
      this.setupCache.set(id, p)
    }
    return p
  }

  vgBin(): string {
    if (!this.vgBinCached) {
      this.vgBinCached = findVg()
    }
    return this.vgBinCached
  }

  private async buildSetup(entry: DatasetConfigEntry): Promise<DatasetSetup> {
    const t0 = Date.now()
    const backend = entry.backend ?? 'odgi'
    const indexPath =
      backend === 'vg'
        ? await ensureXg(entry.graph, this.vgBin())
        : await ensureOg(entry.graph, this.odgiBin)
    const cached = loadPathsCache(indexPath)
    let paths: PathInfo[]
    let cacheStatus: string
    if (cached) {
      paths = cached
      cacheStatus = 'CACHE'
    } else {
      const { names, lengths } =
        backend === 'vg'
          ? await vgPathsList(this.vgBin(), indexPath)
          : await odgiPathsList(this.odgiBin, indexPath)
      paths = names.map(name => {
        const len = lengths.get(name) ?? 0
        const parsed = parsePanSN(name, len)
        return {
          name,
          length: len,
          genome: parsed.genome,
          refName: parsed.refName,
          subwalkStart: parsed.subwalkStart,
          subwalkEnd: parsed.subwalkEnd,
        }
      })
      writePathsCache(indexPath, paths)
      cacheStatus = 'fresh'
    }
    console.log(
      `[graph-server] setup ${entry.id} (${backend}, ${cacheStatus}) in ${Date.now() - t0}ms: ${paths.length} paths`,
    )
    return {
      id: entry.id,
      indexPath,
      backend,
      graphFile: entry.graph,
      paths,
    }
  }
}

interface PathsCache {
  // Stat invariants for the .og/.xg the cache was built from. If the index is
  // rebuilt (e.g. user re-runs `odgi build`) these change and we re-enumerate.
  indexSize: number
  indexMtimeMs: number
  paths: PathInfo[]
}

function pathsCachePath(indexPath: string) {
  return `${indexPath}.paths.json`
}

function loadPathsCache(indexPath: string): PathInfo[] | undefined {
  const cachePath = pathsCachePath(indexPath)
  if (!fs.existsSync(cachePath)) {
    return undefined
  }
  try {
    const stat = fs.statSync(indexPath)
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as PathsCache
    if (cache.indexSize !== stat.size || cache.indexMtimeMs !== stat.mtimeMs) {
      return undefined
    }
    return cache.paths
  } catch (e) {
    console.warn(
      `[graph-server] paths cache at ${cachePath} unreadable, will re-enumerate:`,
      e,
    )
    return undefined
  }
}

function writePathsCache(indexPath: string, paths: PathInfo[]) {
  try {
    const stat = fs.statSync(indexPath)
    const cache: PathsCache = {
      indexSize: stat.size,
      indexMtimeMs: stat.mtimeMs,
      paths,
    }
    const cachePath = pathsCachePath(indexPath)
    const tmp = `${cachePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(cache))
    fs.renameSync(tmp, cachePath)
  } catch (e) {
    console.warn(
      `[graph-server] failed to write paths cache for ${indexPath}:`,
      e,
    )
  }
}

// Path-name suffix that encodes a subwalk range. Odgi uses colon
// (`sample#0#chr20:100864-26386516`); vg uses brackets
// (`sample#chr20[100864-26386516]`).
export const RE_PATH_SUBWALK_COLON = /:(-?\d+)-(-?\d+)$/
const RE_PATH_SUBWALK_BRACKET = /\[(-?\d+)-(-?\d+)\]$/

// PanSN: "sample#hap#contig" → genome="sample#hap", refName="contig".
// W-line-derived subwalk names like "sample#hap#contig:start-end" parse to
// genome="sample#hap", refName="contig", subwalkStart=start, subwalkEnd=end.
// Fallback: bare names get genome=name, refName=name.
export function parsePanSN(name: string, length = 0) {
  let stripped = name
  let subwalkStart = 0
  let subwalkEnd = length
  const m = RE_PATH_SUBWALK_COLON.exec(name) ?? RE_PATH_SUBWALK_BRACKET.exec(name)
  if (m) {
    stripped = name.slice(0, m.index)
    subwalkStart = Number(m[1])
    subwalkEnd = Number(m[2])
  }
  const parts = stripped.split('#')
  // vg emits 4-part `sample#hap#contig#fragment` for fragmented haplotype
  // assemblies — the trailing fragment index is a vg-internal split key
  // that should be dropped so the genome aggregates to `sample#hap`,
  // matching the W-line synteny output.
  if (parts.length >= 3) {
    return {
      genome: `${parts[0]!}#${parts[1]!}`,
      refName: parts[2]!,
      subwalkStart,
      subwalkEnd,
    }
  }
  if (parts.length === 2) {
    return {
      genome: parts[0]!,
      refName: parts[1]!,
      subwalkStart,
      subwalkEnd,
    }
  }
  return { genome: stripped, refName: stripped, subwalkStart, subwalkEnd }
}

export interface ResolvedPath {
  // Full odgi path name (use this in `path:start-end` queries)
  pathName: string
  // Path-relative coordinates corresponding to the requested genomic range
  pathStart: number
  pathEnd: number
  // The matched path's metadata (for translating back to genomic coords)
  subwalkStart: number
  subwalkEnd: number
  refName: string
  genome: string
}

// Find which path covers (assemblyName, refName, queryStart, queryEnd).
// For non-subwalk paths (subwalkStart=0, subwalkEnd=length), returns the
// query as-is. For W-line subwalks like "CHM13#0#chr20:100864-26386516",
// translates the query into path-relative coordinates.
export function resolvePathName(
  paths: PathInfo[],
  assemblyName: string,
  refName: string,
  queryStart = 0,
  queryEnd = Number.MAX_SAFE_INTEGER,
): ResolvedPath | undefined {
  // Prefer paths whose subwalk overlaps the query
  const candidates = paths.filter(
    p => p.genome === assemblyName && p.refName === refName,
  )
  if (candidates.length === 0) {
    // last-ditch: match by refName only (used when assemblyName isn't known
    // or didn't include a hash)
    for (const p of paths) {
      if (
        p.refName === refName &&
        p.subwalkStart < queryEnd &&
        p.subwalkEnd > queryStart
      ) {
        return makeResolved(p, queryStart, queryEnd)
      }
    }
    return undefined
  }
  // Pick the subwalk that contains the most of the query range.
  let best: PathInfo | undefined
  let bestOverlap = -1
  for (const p of candidates) {
    const overlap =
      Math.min(p.subwalkEnd, queryEnd) - Math.max(p.subwalkStart, queryStart)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = p
    }
  }
  if (!best || bestOverlap <= 0) {
    return undefined
  }
  return makeResolved(best, queryStart, queryEnd)
}

function makeResolved(
  p: PathInfo,
  queryStart: number,
  queryEnd: number,
): ResolvedPath {
  const clampedStart = Math.max(p.subwalkStart, queryStart)
  const clampedEnd = Math.min(p.subwalkEnd, queryEnd)
  return {
    pathName: p.name,
    pathStart: Math.max(0, clampedStart - p.subwalkStart),
    pathEnd: Math.max(0, clampedEnd - p.subwalkStart),
    subwalkStart: p.subwalkStart,
    subwalkEnd: p.subwalkEnd,
    refName: p.refName,
    genome: p.genome,
  }
}
