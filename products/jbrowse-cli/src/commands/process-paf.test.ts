/**
 * @jest-environment node
 */

import path from 'path'

import { setup } from '../testUtil'

const base = path.join(__dirname, '..', '..', 'test', 'data')
const simplePaf = path.join(base, 'volvox_inv_indels.paf')

describe('process-paf', () => {
  setup.command(['process-paf', simplePaf]).it('processes volvox paf', ctx => {
    let res = ''
    for (const obj of ctx.stdoutWrite.mock.calls) {
      res += obj[0]
    }
    expect(res.split('\n').length).toMatchSnapshot()
    expect(res).toMatchSnapshot()
  })
})
