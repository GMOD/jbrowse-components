/**
 * @jest-environment node
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './PairwiseIndexedPAFAdapter/PairwiseIndexedPAFAdapter.ts'
import MyConfigSchema from './PairwiseIndexedPAFAdapter/configSchema.ts'

import type { AddressInfo } from 'node:net'

// What the coarse tier saves a reader, measured rather than reasoned about:
// bytes are counted by the SERVER, because the adapter fetches bgzf blocks by
// range and what a reader downloads is what the socket carried, not the size of
// the rows it ends up parsing.
//
// It measures the two tiers of ONE file rather than two files built differently,
// which is the comparison a release note is making: `--no-coarse` vs default is
// a question about disk (measurements/pif-coarse-tier-bytes.json), and this is
// the question about the reader.
//
// Skipped without PIF_PATH, since it wants a eukaryote-scale PIF that is far too
// large to commit — the coarse tier cannot engage below its 10,000 bp/px
// threshold, so a bacterial fixture would measure nothing (HOSTING.md). Feeds
// measurements/pif-tier-wire-bytes.json; see that record for the repro.
const PIF = process.env.PIF_PATH
const ASSEMBLIES = (process.env.PIF_ASSEMBLIES ?? 'hs1,mm39').split(',')
const INDEX_TYPE = (process.env.PIF_INDEX ?? 'TBI') as 'TBI' | 'CSI'

function serve(file: string) {
  let bytes = 0
  let indexBytes = 0
  let requests = 0
  const server = http.createServer((req, res) => {
    const isIndex = !!(req.url?.includes('.tbi') || req.url?.includes('.csi'))
    const target = isIndex ? `${file}.${INDEX_TYPE.toLowerCase()}` : file
    const size = fs.statSync(target).size
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
    requests++
    if (range) {
      const start = Number(range[1])
      const end = range[2] ? Number(range[2]) : size - 1
      const len = Math.min(end, size - 1) - start + 1
      bytes += len
      if (isIndex) {
        indexBytes += len
      }
      res.writeHead(206, {
        'content-length': len,
        'content-range': `bytes ${start}-${Math.min(end, size - 1)}/${size}`,
      })
      fs.createReadStream(target, { start, end: Math.min(end, size - 1) }).pipe(
        res,
      )
    } else {
      bytes += size
      if (isIndex) {
        indexBytes += size
      }
      res.writeHead(200, { 'content-length': size })
      fs.createReadStream(target).pipe(res)
    }
  })
  return {
    server,
    stats: () => ({
      bytes,
      indexBytes,
      dataBytes: bytes - indexBytes,
      requests,
    }),
    reset: () => {
      bytes = 0
      indexBytes = 0
      requests = 0
    },
  }
}

function makeAdapter(base: string) {
  return new Adapter(
    MyConfigSchema.create({
      pifGzLocation: { uri: `${base}/f.pif.gz`, locationType: 'UriLocation' },
      index: {
        indexType: INDEX_TYPE,
        location: {
          uri: `${base}/f.pif.gz.${INDEX_TYPE.toLowerCase()}`,
          locationType: 'UriLocation',
        },
      },
      assemblyNames: ASSEMBLIES,
    }),
  )
}

const fmt = (n: number) =>
  n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(0)} kB`

jest.setTimeout(900_000)

const maybe = PIF ? test : test.skip

maybe('bytes over the wire, coarse vs fine, at whole-genome zoom', async () => {
  const { server, stats, reset } = serve(PIF!)
  await new Promise<void>(r => {
    server.listen(0, '127.0.0.1', r)
  })
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const probe = makeAdapter(base)
  const refNames = await probe.getRefNames({ assemblyName: ASSEMBLIES[0] })
  // the biggest few refs, which is where a whole-genome view spends its bytes
  const targets = process.env.PIF_REFS
    ? refNames.slice(0, Number(process.env.PIF_REFS))
    : refNames

  const out: Record<string, unknown>[] = []
  for (const lodMode of ['coarse', 'fine'] as const) {
    clearCache()
    reset()
    const adapter = makeAdapter(base)
    let features = 0
    const t0 = performance.now()
    for (const refName of targets) {
      const arr = await firstValueFrom(
        adapter
          .getFeatures(
            {
              refName,
              start: 0,
              end: 300_000_000,
              assemblyName: ASSEMBLIES[0]!,
            },
            { lodMode },
          )
          .pipe(toArray()),
      )
      features += arr.length
    }
    const ms = performance.now() - t0
    const { dataBytes, indexBytes, requests } = stats()
    out.push({
      lodMode,
      dataBytes,
      data: fmt(dataBytes),
      indexBytes,
      requests,
      features,
      ms: Math.round(ms),
    })
  }
  server.close()

  const [coarse, fine] = out as [
    { dataBytes: number; features: number; ms: number },
    { dataBytes: number; features: number; ms: number },
  ]
  // the run's whole output — this asserts nothing, it takes a number, and the
  // JSON is what gets pasted into measurements/pif-tier-wire-bytes.json
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        file: path.basename(PIF!),
        rows: out,
        refCount: targets.length,
        bytesRatio: +(coarse.dataBytes / fine.dataBytes).toFixed(4),
        savedX: +(fine.dataBytes / coarse.dataBytes).toFixed(1),
        featuresRatio: +(coarse.features / fine.features).toFixed(3),
        msRatio: +(fine.ms / coarse.ms).toFixed(1),
      },
      null,
      1,
    ),
  )
})
