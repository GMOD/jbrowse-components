/**
 * @jest-environment node
 */

import path from 'path'

import { setup } from '../testUtil'

const base = path.join(__dirname, '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')
const testConfig = path.join(base, 'test_config.json')

describe('process-paf', () => {
  setup
    .command(['process-paf', simplePaf])
    .it('fails if load flag isnt passed in for a localFile', ctx => {
      console.log(ctx.stdoutWrite)
    })
})
