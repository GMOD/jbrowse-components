import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const BINARY = path.resolve('tools/gfa-to-tabix/target/release/gfa-to-tabix')
const GFA_FILE = path.resolve(
  'test/data/synteny-demo/synthetic/synthetic_4genome.gfa',
)

function withTmpDir(fn: (dir: string) => void) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfa-tabix-test-'))
  try {
    fn(tmpDir)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function runConverter(
  gfaFile: string,
  prefix: string,
  extraArgs: string[] = [],
) {
  execSync(`"${BINARY}" "${gfaFile}" "${prefix}" ${extraArgs.join(' ')}`, {
    stdio: 'pipe',
    env: { ...process.env, LC_ALL: 'C' },
  })
}

function tabixQuery(file: string, region: string) {
  try {
    return execSync(`tabix "${file}" "${region}"`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(l => l.length > 0)
  } catch {
    return []
  }
}

const RECORD_SIZE = 15

interface SegRecord {
  segOrd: number
  pathNameIdx: number
  offset: number
  segLen: number
  orient: number
}

function readSegsBinary(prefix: string) {
  const buf = fs.readFileSync(`${prefix}.segments.bin`)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const count = Math.floor(buf.byteLength / RECORD_SIZE)
  const records: SegRecord[] = []
  for (let i = 0; i < count; i++) {
    const off = i * RECORD_SIZE
    records.push({
      segOrd: dv.getUint32(off, true),
      pathNameIdx: dv.getUint16(off + 4, true),
      offset: dv.getUint32(off + 6, true),
      segLen: dv.getUint32(off + 10, true),
      orient: buf[off + 14]!,
    })
  }
  return records
}

function readSegsIdx(prefix: string) {
  const buf = fs.readFileSync(`${prefix}.segments.idx`)
  const aligned = new ArrayBuffer(buf.byteLength)
  new Uint8Array(aligned).set(buf)
  return new BigUint64Array(aligned)
}

function querySegsRange(prefix: string, minOrd: number, maxOrd: number) {
  const idx = readSegsIdx(prefix)
  const startOffset = Number(idx[minOrd]!)
  const endOffset = Number(idx[Math.min(maxOrd + 1, idx.length - 1)]!)
  const all = readSegsBinary(prefix)
  const startRecord = Math.floor(startOffset / RECORD_SIZE)
  const endRecord = Math.floor(endOffset / RECORD_SIZE)
  return all.slice(startRecord, endRecord)
}

beforeAll(() => {
  if (!fs.existsSync(BINARY)) {
    throw new Error(
      `Rust binary not found at ${BINARY}. Run: cargo build --release --manifest-path tools/gfa-to-tabix/Cargo.toml`,
    )
  }
})

describe('gfa-to-tabix converter', () => {
  it('creates pos.bed.gz and segments.bin with indexes', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      expect(fs.existsSync(`${prefix}.pos.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.pos.bed.gz.tbi`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segments.bin`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segments.idx`)).toBe(true)
    })
  })

  it('pos.bed.gz can be queried by genome path', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const results = tabixQuery(`${prefix}.pos.bed.gz`, 'ref#1#chr1:0-100000')
      expect(results.length).toBeGreaterThan(0)

      const cols = results[0]!.split('\t')
      expect(cols.length).toBe(4)
      expect(cols[0]).toBe('ref#1#chr1')
    })
  })

  it('segments.bin has correct 15-byte record size', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const records = readSegsBinary(prefix)
      expect(records.length).toBeGreaterThan(0)
      const stat = fs.statSync(`${prefix}.segments.bin`)
      expect(stat.size % RECORD_SIZE).toBe(0)
      expect(stat.size / RECORD_SIZE).toBe(records.length)
    })
  })

  it('shared segments appear for multiple genomes', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const results = querySegsRange(prefix, 0, 0)
      expect(results.length).toBe(4)
      const pathIndices = results.map(r => r.pathNameIdx)
      expect(new Set(pathIndices).size).toBe(4)
    })
  })

  it('companion index has monotonic offsets', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const idx = readSegsIdx(prefix)
      expect(idx.length).toBeGreaterThan(1)
      for (let i = 1; i < idx.length; i++) {
        expect(idx[i]!).toBeGreaterThanOrEqual(idx[i - 1]!)
      }
    })
  })

  it('filters by assemblies', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix, ['--assemblies', 'ref#1,sample1#1'])

      const results = querySegsRange(prefix, 0, 0)
      expect(results.length).toBe(2)
      const pathIndices = results.map(r => r.pathNameIdx)
      expect(new Set(pathIndices).size).toBe(2)
    })
  })

  it('includes #sizes header', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const header = execSync(`zcat "${prefix}.pos.bed.gz" | head -5`, {
        encoding: 'utf8',
      })
      const sizesLine = header.split('\n').find(l => l.startsWith('#sizes='))
      expect(sizesLine).toBeDefined()
      const entries = sizesLine!.replace('#sizes=', '').split(',')
      expect(entries.length).toBe(4)
    })
  })

  it('chunk size controls granularity', () => {
    withTmpDir(dir => {
      const prefix10 = path.join(dir, 'chunk10')
      runConverter(GFA_FILE, prefix10, ['--chunk-size', '10'])
      const results10 = tabixQuery(
        `${prefix10}.pos.bed.gz`,
        'ref#1#chr1:0-10000000',
      )

      const prefix100 = path.join(dir, 'chunk100')
      runConverter(GFA_FILE, prefix100, ['--chunk-size', '100'])
      const results100 = tabixQuery(
        `${prefix100}.pos.bed.gz`,
        'ref#1#chr1:0-10000000',
      )

      expect(results10.length).toBeGreaterThan(results100.length)
    })
  })

  it('sharded mode creates per-genome segments and manifest', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix, ['--sharded'])

      expect(fs.existsSync(`${prefix}.segments.manifest.json`)).toBe(true)

      const manifest = JSON.parse(
        fs.readFileSync(`${prefix}.segments.manifest.json`, 'utf8'),
      )
      expect(manifest.genomes.sort()).toEqual(
        ['ref#1', 'sample1#1', 'sample2#1', 'sample3#1'].sort(),
      )

      for (const genome of manifest.genomes) {
        const shardPrefix = path.join(
          path.dirname(prefix),
          manifest.files[genome],
        )
        expect(fs.existsSync(`${shardPrefix}.bin`)).toBe(true)
        expect(fs.existsSync(`${shardPrefix}.idx`)).toBe(true)
      }
    })
  })

  it('sharded rows equal combined rows', () => {
    withTmpDir(dir => {
      const combinedPrefix = path.join(dir, 'combined')
      runConverter(GFA_FILE, combinedPrefix)
      const combinedRecords = readSegsBinary(combinedPrefix)

      const shardedPrefix = path.join(dir, 'sharded')
      runConverter(GFA_FILE, shardedPrefix, ['--sharded'])

      const manifest = JSON.parse(
        fs.readFileSync(`${shardedPrefix}.segments.manifest.json`, 'utf8'),
      )

      let shardedTotal = 0
      for (const genome of manifest.genomes) {
        const shardFile = path.join(
          path.dirname(shardedPrefix),
          `${manifest.files[genome]}.bin`,
        )
        const stat = fs.statSync(shardFile)
        shardedTotal += stat.size / RECORD_SIZE
      }

      expect(shardedTotal).toBe(combinedRecords.length)
    })
  })

  it('synteny projection: ref → other genomes via segments', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const posResults = tabixQuery(
        `${prefix}.pos.bed.gz`,
        'ref#1#chr1:0-100000',
      )
      const ordinalSet = new Set<number>()
      for (const line of posResults) {
        const cols = line.split('\t')
        for (const token of cols[3]!.split(',')) {
          const dash = token.indexOf('-')
          if (dash > 0) {
            const lo = +token.slice(0, dash)
            const hi = +token.slice(dash + 1)
            for (let o = lo; o <= hi; o++) {
              ordinalSet.add(o)
            }
          } else {
            ordinalSet.add(+token)
          }
        }
      }
      const sorted = [...ordinalSet].sort((a, b) => a - b)
      const minOrd = sorted[0]!
      const maxOrd = sorted[sorted.length - 1]!

      const segResults = querySegsRange(prefix, minOrd, maxOrd)
      const byPath = new Map<number, SegRecord[]>()
      for (const rec of segResults) {
        if (!byPath.has(rec.pathNameIdx)) {
          byPath.set(rec.pathNameIdx, [])
        }
        byPath.get(rec.pathNameIdx)!.push(rec)
      }

      expect(byPath.size).toBe(4)
    })
  })
})
