/**
 * @jest-environment node
 */

import path from 'path'
import fs from 'fs'
import { setup } from '../testUtil'
import { gunzipSync } from 'zlib'

const base = path.join(__dirname, '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

describe('make-pif', () => {
  const fn = path.basename(simplePaf, '.paf') + '.pif.gz'
  setup
    .command(['make-pif', simplePaf, '--out', fn])
    .it('processes volvox paf', () => {
      expect(exists(fn)).toBeTruthy()
      expect(gunzipSync(fs.readFileSync(fn)).toString()).toMatchSnapshot()
    })
  setup.command(['make-pif', simplePaf, '--out', fn, '--csi']).it('csi', () => {
    expect(exists(fn)).toBeTruthy()
    expect(exists(fn + '.csi')).toBeTruthy()
  })
})
