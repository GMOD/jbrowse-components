import { markColorOf } from './sourcesLogic.ts'

import type { Source } from '../util.ts'

const sources: Source[] = [
  { name: 'a', color: '#0a0a0a', rowColor: '#a0a0a0' },
  { name: 'b', rowColor: '#0000ff' },
  { name: 'c', color: '#0c0c0c' },
]

describe('markColorOf', () => {
  it("paints each row's resolved colour while the row colour paints the marks", () => {
    expect(sources.map(s => markColorOf(s, true))).toEqual([
      '#a0a0a0',
      '#0000ff',
      undefined,
    ])
  })

  it('paints the row its own colour otherwise', () => {
    expect(sources.map(s => markColorOf(s, false))).toEqual([
      '#0a0a0a',
      undefined,
      '#0c0c0c',
    ])
  })
})
