/**
 * @jest-environment node
 */

import path, { basename } from 'path'
import fs from 'fs'
import { setup } from '../testUtil'

const base = path.join(__dirname, '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

const exists = (p: string) => fs.existsSync(p)

describe('create-pif', () => {
  setup
    .command(['create-pifgz', simplePaf])
    .it('processes volvox paf', async ctx => {
      expect(exists(basename(simplePaf, '.paf') + '.pif.gz')).toBeTruthy()
    })
})
