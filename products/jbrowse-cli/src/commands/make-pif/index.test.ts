/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'

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

test('make-pif with --mergeGap emits T/Q coarse tier', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand([
      'make-pif',
      simplePaf,
      '--out',
      fn,
      '--mergeGap',
      '50000',
    ])
    const content = gunzipSync(fs.readFileSync(fn)).toString()
    const lines = content.split('\n').filter(Boolean)
    expect(lines.some(l => l.startsWith('T'))).toBe(true)
    expect(lines.some(l => l.startsWith('Q'))).toBe(true)
    expect(lines.some(l => l.startsWith('t'))).toBe(true)
    expect(lines.some(l => l.startsWith('q'))).toBe(true)
    const coarseLine = lines.find(l => l.startsWith('T'))!
    expect(coarseLine).not.toMatch(/cg:Z:/)
    expect(coarseLine).toMatch(/de:f:/)
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
