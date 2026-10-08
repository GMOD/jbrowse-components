import {
  markColorOf,
  sourceWarnings,
  sourcesFromRegionData,
} from './sourcesLogic.ts'
import { makeSource } from './testEnv.ts'

import type { Source } from '../util.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

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

const region = (
  rows: Record<string, unknown>[],
  warnings?: string[],
): WiggleDataResult => ({
  sources: rows.map(row => ({ ...makeSource(`${row.name}`), ...row })),
  ...(warnings ? { warnings } : {}),
})

test('a row keeps every column its source carries and none of its arrays', () => {
  const rows = sourcesFromRegionData(
    new Map([
      [0, region([{ name: 'a', tissue: 'liver', color: '#f00' }])],
      [
        1,
        region([
          { name: 'a', tissue: 'liver' },
          { name: 'b', batch: 2 },
        ]),
      ],
    ]),
  )
  expect(rows).toEqual([
    { name: 'a', tissue: 'liver', color: '#f00' },
    { name: 'b', batch: 2 },
  ])
})

test('a warning every region repeats is listed once', () => {
  expect(
    sourceWarnings(
      new Map([
        [0, region([{ name: 'a' }], ['1 of 3 samples unmatched'])],
        [1, region([{ name: 'a' }], ['1 of 3 samples unmatched'])],
        [2, region([{ name: 'a' }])],
      ]),
    ),
  ).toEqual(['1 of 3 samples unmatched'])
})
