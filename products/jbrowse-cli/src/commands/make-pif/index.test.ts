/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'
import { gunzipSync } from 'node:zlib'

import { runCommand, runInTmpDir } from '../../testUtil.ts'
import { createPIF } from './pif-generator.ts'

const base = path.join(__dirname, '..', '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

// discards the PIF output; the tests using it only care about the returned
// PanSN detection
const sink = () =>
  new Writable({
    write(_chunk, _enc, cb) {
      cb()
    },
  })

test('make-pif', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    expect(exists(fn)).toBeTruthy()
    expect(gunzipSync(fs.readFileSync(fn)).toString()).toMatchSnapshot()
  })
})

test('make-pif with --coarse emits T/Q coarse tier with CIGAR stripped', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--coarse', '50000'])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    const fineT = lines.filter(l => l.startsWith('t'))
    const fineQ = lines.filter(l => l.startsWith('q'))
    const coarseT = lines.filter(l => l.startsWith('T'))
    const coarseQ = lines.filter(l => l.startsWith('Q'))
    expect(coarseT.length).toBeGreaterThan(0)
    expect(coarseQ.length).toBeGreaterThan(0)
    // strip-only mode (no row had a >=50kb indel): coarse row count matches
    // fine. Any split would only inflate coarse counts.
    expect(coarseT.length).toBeGreaterThanOrEqual(fineT.length)
    expect(coarseQ.length).toBeGreaterThanOrEqual(fineQ.length)
    for (const l of coarseT) {
      expect(l).not.toMatch(/cg:Z:/)
      expect(l).toMatch(/de:f:/)
    }
  })
})

test('make-pif emits T/Q coarse tier by default', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    const coarseT = lines.filter(l => l.startsWith('T'))
    const coarseQ = lines.filter(l => l.startsWith('Q'))
    expect(coarseT.length).toBeGreaterThan(0)
    expect(coarseQ.length).toBeGreaterThan(0)
    for (const l of coarseT) {
      expect(l).not.toMatch(/cg:Z:/)
      expect(l).toMatch(/de:f:/)
    }
  })
})

test('make-pif --no-coarse omits T/Q coarse tier', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--no-coarse'])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    expect(lines.some(l => l.startsWith('T'))).toBe(false)
    expect(lines.some(l => l.startsWith('Q'))).toBe(false)
  })
})

test('make-pif converts a cs difference string to a cg CIGAR', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'cs.paf')
    // one PAF row on + strand carrying only a cs:Z: tag (no cg:Z:)
    fs.writeFileSync(
      pafPath,
      `${[
        'q1',
        '100',
        '0',
        '10',
        '+',
        't1',
        '100',
        '0',
        '10',
        '9',
        '10',
        '60',
        'cs:Z::6*ct+gt:1',
      ].join('\t')}\n`,
    )
    const fn = 'cs.pif.gz'
    await runCommand(['make-pif', pafPath, '--out', fn, '--no-coarse'])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const tRow = lines.find(l => l.startsWith('t'))!
    const qRow = lines.find(l => l.startsWith('q'))!
    // cs :6*ct+gt:1 -> 6=1X2I1=; q-row swaps I<->D on + strand
    expect(tRow).toContain('cg:Z:6=1X2I1=')
    expect(qRow).toContain('cg:Z:6=1X2D1=')
    expect(tRow).not.toContain('cs:Z:')
  })
})

test('coarse-tier identity matches the fine tier (no LOD-threshold jump)', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const de = (l: string) =>
      l
        .split('\t')
        .find(f => f.startsWith('de:f:'))
        ?.slice(5)
    // Every fine `t` row carries the aligner's de:f: tag; a coarse `T` row must
    // reuse that exact value rather than recomputing a divergent one, so
    // identity coloring is continuous across the coarse/fine LOD switch.
    const fineDe = new Set(lines.filter(l => l.startsWith('t')).map(de))
    const coarseDe = lines.filter(l => l.startsWith('T')).map(de)
    expect(coarseDe.length).toBeGreaterThan(0)
    for (const d of coarseDe) {
      expect(fineDe.has(d)).toBe(true)
    }
  })
})

test('coarse tier keeps the aligner de:f: tag for a plain M CIGAR', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'mcigar.paf')
    // A plain `cg:Z:100M` CIGAR folds substitutions into M, so a CIGAR
    // recompute would report 0 divergence. minimap2's de:f: tag carries the
    // real 10% divergence and must survive into the (unsplit) coarse row.
    fs.writeFileSync(
      pafPath,
      `${[
        'q1',
        '100',
        '0',
        '100',
        '+',
        't1',
        '100',
        '0',
        '100',
        '90',
        '100',
        '60',
        'cg:Z:100M',
        'de:f:0.100000',
      ].join('\t')}\n`,
    )
    const fn = 'mcigar.pif.gz'
    await runCommand(['make-pif', pafPath, '--out', fn])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const coarseT = lines.find(l => l.startsWith('T'))!
    const coarseQ = lines.find(l => l.startsWith('Q'))!
    expect(coarseT).toContain('de:f:0.100000')
    expect(coarseQ).toContain('de:f:0.100000')
  })
})

test('coarse identity matches fine for a cg CIGAR with no de:f: tag', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'nodetag.paf')
    // A cg:Z:100M CIGAR folds substitutions into M, and there is NO de:f: tag.
    // The row's own num_matches/block_len columns (90/100) are the only honest
    // identity signal. A CIGAR recompute would report 0 divergence (100%
    // identity) — the coarse tier must instead reuse 1 - 90/100 = 0.1 so it
    // colors identically to the fine tier across the LOD switch.
    fs.writeFileSync(
      pafPath,
      `${[
        'q1',
        '100',
        '0',
        '100',
        '+',
        't1',
        '100',
        '0',
        '100',
        '90',
        '100',
        '60',
        'cg:Z:100M',
      ].join('\t')}\n`,
    )
    const fn = 'nodetag.pif.gz'
    await runCommand(['make-pif', pafPath, '--out', fn])
    const lines = gunzipSync(fs.readFileSync(fn))
      .toString()
      .split('\n')
      .filter(Boolean)
    const coarseT = lines.find(l => l.startsWith('T'))!
    const coarseQ = lines.find(l => l.startsWith('Q'))!
    expect(coarseT).toContain('de:f:0.100000')
    expect(coarseQ).toContain('de:f:0.100000')
  })
})

test('detects a plain-named PAF as pairwise (no PanSN samples)', async () => {
  const { samples } = await createPIF(simplePaf, sink())
  expect(samples.size).toBe(0)
})

test('collects the PanSN sample names from an all-vs-all PAF', async () => {
  await runInTmpDir(async ({ dir }) => {
    const pafPath = path.join(dir, 'ava.paf')
    const rows = fs
      .readFileSync(simplePaf, 'utf8')
      .trim()
      .split('\n')
      .map(l => {
        const p = l.split('\t')
        p[0] = `K12#1#${p[0]}`
        p[5] = `Sakai#1#${p[5]}`
        return p.join('\t')
      })
    fs.writeFileSync(pafPath, `${rows.join('\n')}\n`)
    const { samples } = await createPIF(pafPath, sink())
    expect([...samples].sort()).toEqual(['K12', 'Sakai'])
  })
})

test('make pif with CSI', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--csi'])
    expect(exists(fn)).toBeTruthy()
    expect(exists(`${fn}.csi`)).toBeTruthy()
  })
})
