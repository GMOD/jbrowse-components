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

const describeIfBinary = fs.existsSync(BINARY) ? describe : describe.skip

describeIfBinary('gfa-to-tabix converter', () => {
  it('creates pos.bed.gz and synteny files with indexes', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      expect(fs.existsSync(`${prefix}.pos.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.pos.bed.gz.tbi`)).toBe(true)
      expect(fs.existsSync(`${prefix}.synteny.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.synteny.bed.gz.tbi`)).toBe(true)
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

  it('synteny.bed.gz can be queried', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      const results = tabixQuery(
        `${prefix}.synteny.bed.gz`,
        'ref#1#chr1:0-100000',
      )
      expect(results.length).toBeGreaterThan(0)
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

  it('filters by assemblies', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix, ['--assemblies', 'ref#1,sample1#1'])

      expect(fs.existsSync(`${prefix}.pos.bed.gz`)).toBe(true)
      const results = tabixQuery(`${prefix}.pos.bed.gz`, 'ref#1#chr1:0-100000')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  it('seglens.bin is created', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      expect(fs.existsSync(`${prefix}.seglens.bin`)).toBe(true)
      const stat = fs.statSync(`${prefix}.seglens.bin`)
      expect(stat.size).toBeGreaterThan(0)
    })
  })

  it('edges spatial index is created', () => {
    withTmpDir(dir => {
      const prefix = path.join(dir, 'test')
      runConverter(GFA_FILE, prefix)

      expect(fs.existsSync(`${prefix}.edges.spatial.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.edges.spatial.bed.gz.tbi`)).toBe(true)
    })
  })
})
