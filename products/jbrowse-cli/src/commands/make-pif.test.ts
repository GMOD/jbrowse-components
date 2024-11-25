/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { gunzipSync } from 'zlib'
import { runCommand } from '@oclif/test'
import { runInTmpDir } from '../testUtil'

const base = path.join(__dirname, '..', '..', 'test', 'data')
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

test('make pif with CSI', async () => {
  await runInTmpDir(async () => {
    const fn = `${path.basename(simplePaf, '.paf')}.pif.gz`
    await runCommand(['make-pif', simplePaf, '--out', fn, '--csi'])
    expect(exists(fn)).toBeTruthy()
    expect(exists(`${fn}.csi`)).toBeTruthy()
  })
})
