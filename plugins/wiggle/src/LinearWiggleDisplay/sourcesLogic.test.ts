import { UNCOLORED_ROW, wiggleMarkSources } from '../shared/wiggleColor.ts'
import { sourceWarnings, sourcesFromRegionData } from './sourcesLogic.ts'
import { makeSource } from './testEnv.ts'

import type { Source } from '../util.ts'
import type { WiggleDataResult } from '@jbrowse/wiggle-core'

const sources: Source[] = [
  { name: 'a', color: '#0a0a0a', rowColor: '#a0a0a0' },
  { name: 'b', rowColor: '#0000ff' },
  { name: 'c', color: '#0c0c0c' },
]

describe('wiggleMarkSources', () => {
  const colors = (opts: Parameters<typeof wiggleMarkSources>[1]) =>
    wiggleMarkSources(sources, opts).map(s => s.color)

  it("paints each row's resolved row color, never the file's own", () => {
    expect(
      colors({
        rowColorPaintsMarks: true,
        paletteDeals: false,
        anyRowColored: true,
      }),
    ).toEqual(['#a0a0a0', '#0000ff', undefined])
  })

  it('paints no source color while a written color or a gradient does', () => {
    expect(
      colors({
        rowColorPaintsMarks: false,
        paletteDeals: false,
        anyRowColored: true,
      }),
    ).toEqual([undefined, undefined, undefined])
  })

  it('greys a row left uncolored beside dealt ones', () => {
    expect(
      colors({
        rowColorPaintsMarks: true,
        paletteDeals: true,
        anyRowColored: true,
      }),
    ).toEqual(['#a0a0a0', '#0000ff', UNCOLORED_ROW])
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
