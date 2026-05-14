import express from 'express'

import { DatasetRegistry, resolvePathName } from './datasets.ts'
import { odgiExtract } from './odgi.ts'
import { computeSyntenyBlocks, parseExtractedGfa } from './synteny.ts'
import { vgExtract } from './vg.ts'

import type { DatasetSetup } from './datasets.ts'
import type { NextFunction, Request, Response } from 'express'

// Shared LRU of extracted GFAs keyed by (datasetId, region, context). The
// extract step dominates wall time on large graphs (HPRC chr20 1.13 GB .og:
// ~15s/call with 16 threads); a cache hit lets repeat pans/zooms / display-
// setting changes / Multi-LGV refreshes finish in single-digit ms. Plain JS
// Map preserves insertion order, so re-set-after-delete gives LRU semantics.
const EXTRACT_CACHE_MAX = Number(
  process.env.GRAPH_SERVER_EXTRACT_CACHE_MAX ?? 64,
)
const extractCache = new Map<string, string>()

function cacheGet(key: string): string | undefined {
  const v = extractCache.get(key)
  if (v !== undefined) {
    extractCache.delete(key)
    extractCache.set(key, v)
  }
  return v
}

function cacheSet(key: string, val: string) {
  if (extractCache.has(key)) {
    extractCache.delete(key)
  } else if (extractCache.size >= EXTRACT_CACHE_MAX) {
    const oldest = extractCache.keys().next().value
    if (oldest !== undefined) {
      extractCache.delete(oldest)
    }
  }
  extractCache.set(key, val)
}

const PORT = Number(process.env.PORT ?? 5001)
const CONFIG_PATH = process.env.GRAPH_SERVER_DATASETS
if (!CONFIG_PATH) {
  console.error(
    'GRAPH_SERVER_DATASETS env var must point at a datasets.json file',
  )
  process.exit(1)
}

const registry = new DatasetRegistry(CONFIG_PATH)

function runExtract(setup: DatasetSetup, region: string, context: number) {
  if (setup.backend === 'vg') {
    return vgExtract({
      vgBin: registry.vgBin(),
      xgPath: setup.indexPath,
      region,
      context,
    })
  }
  return odgiExtract({
    odgiBin: registry.odgiBin,
    ogPath: setup.indexPath,
    region,
    context,
  })
}

// Fetch the extracted GFA for (dataset, region, ctx), using the LRU when
// possible. Returns the GFA along with a short status string suitable for
// the request log line.
async function cachedExtract(
  setup: DatasetSetup,
  datasetId: string,
  region: string,
  ctx: number,
) {
  const cacheKey = `${datasetId}|${region}|${ctx}`
  const hit = cacheGet(cacheKey)
  if (hit !== undefined) {
    return { gfa: hit, status: 'CACHE' }
  }
  const r = await runExtract(setup, region, ctx)
  cacheSet(cacheKey, r.gfa)
  return {
    gfa: r.gfa,
    status: `${setup.backend} ${r.ms}ms (extract ${r.extractMs}ms view ${r.viewMs}ms)`,
  }
}

const app = express()
app.use(express.json({ limit: '1mb' }))

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept',
  )
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  next()
})

app.options('/api/v0/*splat', (_req, res) => {
  res.sendStatus(204)
})

const api = express.Router()
app.use('/api/v0', api)

api.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    odgi: registry.odgiBin,
    datasets: registry.list(),
  })
})

api.get('/datasets/:id/setup', async (req, res, next) => {
  try {
    const setup = await registry.getSetup(req.params.id)
    const assemblies = [...new Set(setup.paths.map(p => p.genome))]
    // Per (genome, refName), report max(subwalkEnd) as the chromosome
    // length so JBrowse sees one chr20 entry per assembly even when the
    // graph stores it as several non-contiguous subwalks.
    const chromMax = new Map<string, number>()
    for (const p of setup.paths) {
      const key = `${p.genome}\t${p.refName}`
      const prev = chromMax.get(key) ?? 0
      if (p.subwalkEnd > prev) {
        chromMax.set(key, p.subwalkEnd)
      }
    }
    const chromSizes = [...chromMax].map(([key, length]) => {
      const [genome, refName] = key.split('\t') as [string, string]
      return { genome, refName, length }
    })
    res.json({
      id: setup.id,
      paths: setup.paths,
      assemblies,
      chromSizes,
    })
  } catch (e) {
    next(e)
  }
})

interface SubgraphBody {
  refName: string
  start: number
  end: number
  genome?: string
  context?: number
}

api.post('/datasets/:id/subgraph', async (req, res, next) => {
  try {
    const setup = await registry.getSetup(req.params.id)
    const body = req.body as SubgraphBody
    const ctx = body.context ?? 1
    const resolved = resolvePathName(
      setup.paths,
      body.genome ?? '',
      body.refName,
      Math.max(0, body.start),
      body.end,
    )
    if (!resolved) {
      console.warn(
        `[graph-server] no path matches genome=${body.genome ?? '(any)'} refName=${body.refName} ${body.start}-${body.end}`,
      )
      res.type('text/plain').send('H\tVN:Z:1.1\n')
      return
    }
    const region = `${resolved.pathName}:${resolved.pathStart}-${resolved.pathEnd}`
    const t0 = Date.now()
    const { gfa, status } = await cachedExtract(
      setup,
      req.params.id,
      region,
      ctx,
    )
    const sLines = gfa.split('\n').filter(l => l.startsWith('S\t')).length
    console.log(
      `[graph-server] subgraph ${req.params.id} ${region} c=${ctx} → ${sLines} segments, ${status} total ${Date.now() - t0}ms`,
    )
    res.type('text/plain').send(gfa)
  } catch (e) {
    next(e)
  }
})

interface SyntenyBody {
  refName: string
  start: number
  end: number
  genome?: string
  context?: number
}

api.post('/datasets/:id/synteny', async (req, res, next) => {
  try {
    const setup = await registry.getSetup(req.params.id)
    const body = req.body as SyntenyBody
    const ctx = body.context ?? 1
    const resolved = resolvePathName(
      setup.paths,
      body.genome ?? '',
      body.refName,
      Math.max(0, body.start),
      body.end,
    )
    if (!resolved) {
      res.json({ features: [], note: 'no matching path' })
      return
    }
    const region = `${resolved.pathName}:${resolved.pathStart}-${resolved.pathEnd}`
    const t0 = Date.now()
    const { gfa, status } = await cachedExtract(
      setup,
      req.params.id,
      region,
      ctx,
    )
    const t1 = Date.now()
    const { paths, segSeqs } = parseExtractedGfa(gfa)
    const features = computeSyntenyBlocks({
      refName: resolved.refName,
      refGenome: resolved.genome,
      paths,
      segSeqs,
    })
    const t2 = Date.now()
    console.log(
      `[graph-server] synteny ${req.params.id} ${region} c=${ctx} → ${features.length} blocks across ${paths.length} paths, ${status} parse+walk ${t2 - t1}ms total ${t2 - t0}ms`,
    )
    res.json({ features })
  } catch (e) {
    next(e)
  }
})

app.use(
  (
    err: Error & { status?: number },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error('[graph-server] error:', err.message)
    res.status(err.status ?? 500).json({ error: err.message })
  },
)

app.listen(PORT, () => {
  console.log(`[graph-server] listening on http://localhost:${PORT}`)
  console.log(`[graph-server] odgi: ${registry.odgiBin}`)
})
