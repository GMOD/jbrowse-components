/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import { runCommand, runInTmpDir } from '../../testUtil.ts'

const base = path.join(__dirname, '..', '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

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

test('make pif with CSI', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--csi'])
    expect(exists(fn)).toBeTruthy()
    expect(exists(`${fn}.csi`)).toBeTruthy()
  })
})
