/**
 * @jest-environment node
 */

import path from 'path'
import fs from 'fs'
import { setup } from '../testUtil'

const base = path.join(__dirname, '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

describe('create-pif', () => {
  const fn = path.basename(simplePaf, '.paf') + '.pif.gz'
  setup
    .command(['create-pifgz', simplePaf, '--out', fn])
    .it('processes volvox paf', () => {
      expect(exists(fn)).toBeTruthy()
    })
})
