import Adapter from './GfaTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'
import { parseSegmentsBinary } from './gfaTabixUtils.ts'

const RECORD_SIZE = 15

function generateBinarySegments(numSegments: number, numPaths: number) {
  const totalRecords = numSegments * numPaths
  const buf = new ArrayBuffer(totalRecords * RECORD_SIZE)
  const dv = new DataView(buf)
  const bytes = new Uint8Array(buf)

  let i = 0
  for (let seg = 0; seg < numSegments; seg++) {
    for (let p = 0; p < numPaths; p++) {
      const off = i * RECORD_SIZE
      dv.setUint32(off, seg, true)
      dv.setUint16(off + 4, p, true)
      dv.setUint32(off + 6, seg * 10000, true)
      dv.setUint32(off + 10, 5000 + Math.floor(Math.random() * 5000), true)
      bytes[off + 14] = Math.random() > 0.1 ? 0x2b : 0x2d
      i++
    }
  }
  return bytes
}

describe('parseSegmentsBinary benchmark', () => {
  const NUM_SEGMENTS = 50_000
  const NUM_PATHS = 4
  const bytes = generateBinarySegments(NUM_SEGMENTS, NUM_PATHS)

  it('correctness: parses all records', () => {
    const records = parseSegmentsBinary(bytes)
    expect(records.length).toBe(NUM_SEGMENTS * NUM_PATHS)

    expect(records[0]!.segOrd).toBe(0)
    expect(records[0]!.pathNameIdx).toBe(0)
    expect(records[0]!.offset).toBe(0)

    expect(records[NUM_PATHS]!.segOrd).toBe(1)
    expect(records[NUM_PATHS]!.pathNameIdx).toBe(0)
    expect(records[NUM_PATHS]!.offset).toBe(10000)
  })

  it(`benchmark: parseSegmentsBinary on ${(NUM_SEGMENTS * NUM_PATHS).toLocaleString()} records`, () => {
    const WARMUP = 2
    const ITERS = 5

    for (let i = 0; i < WARMUP; i++) {
      parseSegmentsBinary(bytes)
    }

    const times: number[] = []
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now()
      parseSegmentsBinary(bytes)
      times.push(performance.now() - t0)
    }

    const median = times.sort((a, b) => a - b)[Math.floor(ITERS / 2)]!

    // 200k records in binary should parse very fast
    expect(median).toBeLessThan(200)
  })
})

const hprcPrefix = require
  .resolve(
    '../../../../test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.pos.bed.gz',
  )
  .replace('.pos.bed.gz', '')

function makeAdapter(prefix: string) {
  return new Adapter(
    MyConfigSchema.create({
      posLocation: {
        localPath: `${prefix}.pos.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      posIndex: {
        location: {
          localPath: `${prefix}.pos.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      segmentsLocation: {
        localPath: `${prefix}.segments.bin`,
        locationType: 'LocalPathLocation',
      },
      segmentsIdxLocation: {
        localPath: `${prefix}.segments.idx`,
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

describe('getMultiPairFeatures e2e benchmark (HPRC chrM, 44 haplotypes)', () => {
  it('full-chromosome query timing', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const query = {
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    }

    // warmup (caches index + segment files)
    await adapter.getMultiPairFeatures(query)

    const ITERS = 5
    const times: number[] = []
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now()
      await adapter.getMultiPairFeatures(query)
      times.push(performance.now() - t0)
    }

    const median = times.sort((a, b) => a - b)[Math.floor(ITERS / 2)]!

    expect(median).toBeLessThan(500)
  })
})
