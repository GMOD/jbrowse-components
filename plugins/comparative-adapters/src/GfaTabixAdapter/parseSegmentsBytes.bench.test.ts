import { parseSegmentsBytes } from './gfaTabixUtils.ts'
import Adapter from './GfaTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'

// Original implementation for comparison
function parseSegmentsBytesOld(bytes: Uint8Array, pathNames: string[]) {
  const decoder = new TextDecoder()
  const records: { segOrd: number; pathName: string; offset: number; segLen: number; orient: string }[] = []
  const DECODE_CHUNK = 512 * 1024 * 1024
  let tail = ''

  const parseLine = (line: string) => {
    if (line.length === 0 || line.charCodeAt(0) === 35) {
      return
    }
    const t1 = line.indexOf('\t')
    const t2 = line.indexOf('\t', t1 + 1)
    const t3 = line.indexOf('\t', t2 + 1)
    const t4 = line.indexOf('\t', t3 + 1)
    records.push({
      segOrd: +line.slice(0, t1),
      pathName: pathNames[+line.slice(t1 + 1, t2)] ?? line.slice(t1 + 1, t2),
      offset: +line.slice(t2 + 1, t3),
      segLen: +line.slice(t3 + 1, t4),
      orient: line[t4 + 1]!,
    })
  }

  for (let pos = 0; pos < bytes.length; pos += DECODE_CHUNK) {
    const isLast = pos + DECODE_CHUNK >= bytes.length
    const text =
      tail +
      decoder.decode(bytes.subarray(pos, pos + DECODE_CHUNK), {
        stream: !isLast,
      })
    const lines = text.split('\n')
    tail = lines.pop()!
    for (const line of lines) {
      parseLine(line)
    }
  }
  if (tail.length > 0) {
    parseLine(tail)
  }

  return records
}

function generateSegmentsData(numSegments: number, numPaths: number) {
  const lines: string[] = []
  let segOrd = 0
  for (let i = 0; i < numSegments; i++) {
    for (let p = 0; p < numPaths; p++) {
      const offset = i * 10000
      const segLen = 5000 + Math.floor(Math.random() * 5000)
      const orient = Math.random() > 0.1 ? '+' : '-'
      lines.push(`${segOrd}\t${p}\t${offset}\t${segLen}\t${orient}`)
    }
    segOrd++
  }
  return new TextEncoder().encode(lines.join('\n'))
}

function generatePathNames(numPaths: number) {
  return Array.from({ length: numPaths }, (_, i) => `genome${i}#hap1#chr1`)
}

describe('parseSegmentsBytes benchmark', () => {
  const NUM_SEGMENTS = 50_000
  const NUM_PATHS = 4
  const pathNames = generatePathNames(NUM_PATHS)
  const bytes = generateSegmentsData(NUM_SEGMENTS, NUM_PATHS)

  it('correctness: new implementation matches old', () => {
    const oldResult = parseSegmentsBytesOld(bytes, pathNames)
    const newResult = parseSegmentsBytes(bytes)

    expect(newResult.length).toBe(oldResult.length)
    for (let i = 0; i < Math.min(100, oldResult.length); i++) {
      expect(newResult[i]!.segOrd).toBe(oldResult[i]!.segOrd)
      expect(newResult[i]!.pathNameIdx).toBe(
        pathNames.indexOf(oldResult[i]!.pathName),
      )
      expect(newResult[i]!.offset).toBe(oldResult[i]!.offset)
      expect(newResult[i]!.segLen).toBe(oldResult[i]!.segLen)
      expect(newResult[i]!.orient).toBe(oldResult[i]!.orient.charCodeAt(0))
    }
    const last = oldResult.length - 1
    expect(newResult[last]!.segOrd).toBe(oldResult[last]!.segOrd)
    expect(newResult[last]!.offset).toBe(oldResult[last]!.offset)
  })

  it(`benchmark: old (TextDecoder+split) vs new (binary) on ${(NUM_SEGMENTS * NUM_PATHS).toLocaleString()} records`, () => {
    const WARMUP = 2
    const ITERS = 5

    for (let i = 0; i < WARMUP; i++) {
      parseSegmentsBytesOld(bytes, pathNames)
      parseSegmentsBytes(bytes)
    }

    const oldTimes: number[] = []
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now()
      parseSegmentsBytesOld(bytes, pathNames)
      oldTimes.push(performance.now() - t0)
    }

    const newTimes: number[] = []
    for (let i = 0; i < ITERS; i++) {
      const t0 = performance.now()
      parseSegmentsBytes(bytes)
      newTimes.push(performance.now() - t0)
    }

    const oldMedian = oldTimes.sort((a, b) => a - b)[Math.floor(ITERS / 2)]!
    const newMedian = newTimes.sort((a, b) => a - b)[Math.floor(ITERS / 2)]!
    const speedup = oldMedian / newMedian
    const dataMB = (bytes.length / 1024 / 1024).toFixed(1)

    console.log(
      `parseSegmentsBytes (${dataMB} MB, ${(NUM_SEGMENTS * NUM_PATHS).toLocaleString()} records):\n` +
        `  old (TextDecoder+split): ${oldMedian.toFixed(0)}ms\n` +
        `  new (binary scan):       ${newMedian.toFixed(0)}ms\n` +
        `  speedup:                 ${speedup.toFixed(1)}x`,
    )

    expect(newMedian).toBeLessThan(oldMedian)
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
        localPath: `${prefix}.segments.gz`,
        locationType: 'LocalPathLocation',
      },
      segmentsGziLocation: {
        localPath: `${prefix}.segments.gz.gzi`,
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
    console.log(
      `getMultiPairFeatures (HPRC chrM full, 44 haplotypes):\n` +
        `  median: ${median.toFixed(0)}ms\n` +
        `  all:    [${times.map(t => t.toFixed(0)).join(', ')}]ms`,
    )

    expect(median).toBeLessThan(500)
  })
})
