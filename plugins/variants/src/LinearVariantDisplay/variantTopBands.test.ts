import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { reservedPx } from '@jbrowse/core/util/bandLayout'
import { GROUP_LABEL_HEIGHT } from '@jbrowse/display-kit/groupLabelStyle'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { maxBottom } from '@jbrowse/plugin-features/band'

import {
  KIT,
  recordsCellData,
  recordsDisplayAt,
} from './recordsBand.fixture.ts'
import { createTestEnvironment } from './testEnv.ts'
import {
  BAND_CHIPS_HEIGHT,
  DEFAULT_RECORDS_HEIGHT,
  DEFAULT_ROWS_TRACK_HEIGHT,
  MIN_RECORDS_HEIGHT,
  boundRecordsBand,
  dragRecordsHeight,
  recordsBandHeightOverRows,
  recordsBandStack,
  trackHeightForRows,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

import type { BandRecord } from './recordsBand.fixture.ts'

function geometry(
  over: Partial<Parameters<typeof variantTopBandsGeometry>[0]>,
) {
  return variantTopBandsGeometry({
    records: { active: true, height: 40 },
    showChips: false,
    connectors: { active: false, height: 20 },
    ...over,
  })
}

describe('the band stack', () => {
  // the connector lines end at genomic positions, which is where the records
  // draw, so the records sit above the zone
  test('stacks the records above the connector zone', () => {
    expect(
      geometry({ connectors: { active: true, height: 30 } }),
    ).toMatchObject({
      top: { records: 0, chips: 40, connectors: 40 },
      reserved: { records: 40, chips: 0, connectors: 30 },
      bottom: 70,
    })
  })

  // the rows' tree, facet strip and labels draw over their left edge, so the
  // chips take a strip of their own between the band and the rows
  test('the chips take a strip under the records', () => {
    expect(geometry({ showChips: true })).toMatchObject({
      top: { records: 0, chips: 40, connectors: 40 + BAND_CHIPS_HEIGHT },
      reserved: { records: 40, chips: BAND_CHIPS_HEIGHT, connectors: 0 },
      bottom: 40 + BAND_CHIPS_HEIGHT,
    })
  })

  test('a band that is off costs zero px, not its floor', () => {
    expect(
      geometry({
        records: { active: false, height: 40 },
        connectors: { active: true, height: 30 },
      }),
    ).toMatchObject({
      reserved: { records: 0, chips: 0, connectors: 30 },
      bottom: 30,
    })
  })
})

describe('the height the band holds beside rows', () => {
  const unwritten = (recordsHeight: number, recordsContentHeight: number) =>
    recordsBandHeightOverRows({
      recordsHeight,
      recordsHeightHeld: false,
      recordsContentHeight,
    })
  const written = (recordsHeight: number, recordsContentHeight: number) =>
    recordsBandHeightOverRows({
      recordsHeight,
      recordsHeightHeld: true,
      recordsContentHeight,
    })

  test('unwritten, a stack under the default takes its own height', () => {
    expect(unwritten(120, 37.2)).toBe(38)
  })

  test('unwritten, a stack over the default takes the default', () => {
    expect(unwritten(120, 400)).toBe(120)
  })

  test('unwritten, a band with no records takes nothing', () => {
    expect(unwritten(120, 0)).toBe(0)
  })

  test('a written height holds whatever the records in view need', () => {
    expect(written(120, 37.2)).toBe(120)
    expect(written(120, 400)).toBe(120)
    expect(written(120, 0)).toBe(120)
  })

  // the ceiling is the track's, which only drawn rows put on it
  test('a written height is floored, and has no ceiling of its own', () => {
    expect(written(0, 400)).toBe(MIN_RECORDS_HEIGHT)
    expect(written(1e6, 10)).toBe(1e6)
  })
})

describe('the band over drawn rows comes out of the track', () => {
  const reserved = (height: number, trackHeight: number, written = false) =>
    reservedPx(
      boundRecordsBand({
        band: { active: true, height },
        written,
        trackHeight,
      }),
    )

  test('the default track splits at the band and row defaults', () => {
    expect(DEFAULT_ROWS_TRACK_HEIGHT).toBe(390)
    expect(reserved(DEFAULT_RECORDS_HEIGHT, DEFAULT_ROWS_TRACK_HEIGHT)).toBe(
      DEFAULT_RECORDS_HEIGHT,
    )
  })

  test('unwritten, a shorter track shortens the band to its share', () => {
    expect(reserved(DEFAULT_RECORDS_HEIGHT, 290)).toBe(124)
    expect(reserved(DEFAULT_RECORDS_HEIGHT, 200)).toBe(83)
  })

  test('unwritten, a stack under its share takes its own height', () => {
    expect(reserved(60, 290)).toBe(60)
  })

  test('a written height takes what it states, past the share', () => {
    expect(reserved(DEFAULT_RECORDS_HEIGHT, 290, true)).toBe(
      DEFAULT_RECORDS_HEIGHT,
    )
  })

  test('a written height stops where the rows keep their floor', () => {
    expect(reserved(1e6, 390, true)).toBe(
      390 - BAND_CHIPS_HEIGHT - MIN_BAND_HEIGHT,
    )
    expect(reserved(1e6, BAND_CHIPS_HEIGHT + MIN_BAND_HEIGHT, true)).toBe(0)
  })

  test('a band that is off reserves nothing', () => {
    expect(
      reservedPx(
        boundRecordsBand({
          band: { active: false, height: 120 },
          written: true,
          trackHeight: 390,
        }),
      ),
    ).toBe(0)
  })

  // the stack is the records band alone: the plot is already under the chips
  test('a seam drag stops at the records floor and where the rows keep theirs', () => {
    const stack = recordsBandStack(
      boundRecordsBand({
        band: { active: true, height: 120 },
        written: true,
        trackHeight: 390,
      }),
    )
    expect(dragRecordsHeight(stack, 390, 200)).toBe(200)
    expect(dragRecordsHeight(stack, 390, 1e6)).toBe(
      390 - BAND_CHIPS_HEIGHT - MIN_BAND_HEIGHT,
    )
    expect(dragRecordsHeight(stack, 390, -50)).toBe(MIN_RECORDS_HEIGHT)
  })

  // an unwritten band grows with the track, so the rows gain less than the
  // track does until the band reaches its stack
  test('the track that gives the rows a height', () => {
    const track = (rowsHeight: number, written = false) =>
      trackHeightForRows({ rowsHeight, recordsHeight: 143, written })
    expect(track(200)).toBe(BAND_CHIPS_HEIGHT + 200 + 143)
    expect(track(100)).toBe(BAND_CHIPS_HEIGHT + 185)
    expect(reserved(143, track(100))).toBe(85)
    expect(track(100, true)).toBe(BAND_CHIPS_HEIGHT + 100 + 143)
  })
})

// records nested one inside the next, so no two share a row
const NESTED: BandRecord[] = Array.from({ length: 20 }, (_, i) => [
  `sv${i}`,
  1000 + i * 100,
  60000 - i * 100,
  '<DEL>',
  'DEL',
])

function naturalHeight(records = KIT) {
  const { display } = recordsDisplayAt(records, 51)
  return Math.ceil(maxBottom(display.recordsFitStage.layout))
}

describe('the band on a display', () => {
  test('nested records stack in rows, and the band is the stack', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const items = [...display.recordsLaidOutDataMap.get(0)!.flatbushItems]
    const rowOf = (id: string) => items.find(i => i.featureId === id)!.topPx
    expect(rowOf('>7495>7496')).not.toBe(rowOf('>7494>7499'))
    expect(new Set(items.map(i => i.topPx)).size).toBeGreaterThan(1)
    expect(display.recordsFitStage).toMatchObject({ level: 'full', scale: 1 })
    const natural = naturalHeight()
    expect(natural).toBeLessThan(DEFAULT_RECORDS_HEIGHT)
    expect(display.topBands.reserved.records).toBe(natural)
  })

  test('past its height the fit ladder fits the stack into it', () => {
    const cap = 3 * GROUP_LABEL_HEIGHT
    const { display } = recordsDisplayAt(NESTED, 51, { height: cap })
    expect(display.topBands.reserved.records).toBe(cap)
    expect(display.recordsFitStage.level).not.toBe('full')
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(cap)
  })

  // past the ladder's last rung over rows the band squeezes nothing: a
  // record that does not fit hides whole, counted for the chip beside the
  // band
  test('past every rung a record that does not fit hides, counted', () => {
    const cap = 3 * GROUP_LABEL_HEIGHT
    const { display } = recordsDisplayAt(NESTED, 51, { height: cap })
    expect(display.topBands.reserved.records).toBe(cap)
    expect(display.recordsHiddenCount).toBeGreaterThan(0)
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(cap)
    const hidden = display.recordsLaidOutDataMap
      .get(0)!
      .flatbushItems.filter(i => i.topPx < 0)
    expect(hidden).toHaveLength(display.recordsHiddenCount)
    expect(display.searchFeatureByID(hidden[0]!.featureId)).toBeUndefined()

    const rows = display.availableHeight
    display.showAllRecordRows()
    expect(display.recordsHiddenCount).toBe(0)
    expect(display.topBands.reserved.records).toBe(display.recordsStackHeight)
    expect(display.availableHeight).toBe(rows)
  })

  // the density a feature track refuses its window at: over rows the band
  // cannot refuse the matrix under it, so its records collapse into one row
  test('past the density budget the records collapse into one row', () => {
    const snvs: BandRecord[] = Array.from({ length: 4000 }, (_, i) => [
      `rs${i}`,
      i * 10,
      i * 10 + 1,
      'A -> G',
      '',
    ])
    const sparse = recordsDisplayAt(snvs, 2).display
    const dense = recordsDisplayAt(snvs, 40).display
    expect(sparse.recordsPackMode).toBe('compact')
    expect(dense.recordsLabelDensityPerPx).toBeGreaterThan(
      dense.configuredMaxFeatureScreenDensity,
    )
    expect(dense.recordsPackMode).toBe('collapsed')
    const tops = dense.recordsLaidOutDataMap
      .get(0)!
      .flatbushItems.map(i => i.topPx)
    expect(new Set(tops).size).toBe(1)
    expect(dense.recordsHiddenCount).toBe(0)
  })

  test('turning the band on takes its height from the rows, the track holding', () => {
    const { display } = recordsDisplayAt(KIT, 51, { show: false })
    const height = display.height
    const before = {
      rowsTopOffset: display.rowsTopOffset,
      availableHeight: display.availableHeight,
      effectiveRowHeight: display.effectiveRowHeight,
    }
    expect(before.availableHeight).toBe(height - BAND_CHIPS_HEIGHT)

    display.setShowRecords(true)
    const band = display.topBands.reserved.records
    expect(band).toBeGreaterThan(0)
    expect(display.height).toBe(height)
    expect(display.rowsTopOffset).toBe(band + BAND_CHIPS_HEIGHT)
    expect(display.availableHeight).toBe(before.availableHeight - band)

    display.setShowRecords(false)
    expect(display.height).toBe(height)
    expect({
      rowsTopOffset: display.rowsTopOffset,
      availableHeight: display.availableHeight,
      effectiveRowHeight: display.effectiveRowHeight,
    }).toEqual(before)
  })

  test('the band is a render-tier setting: no fetch input moves', () => {
    const { display } = recordsDisplayAt(KIT, 51, { show: false })
    const key = display.rpcProps()
    display.setShowRecords(true)
    display.setRecordsHeight(40)
    expect(display.rpcProps()).toEqual(key)
  })

  test('the key sits at the top of the band, not pushed under it', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    expect(display.topBands.reserved.records).toBeGreaterThan(0)
    expect(display.legendTop).toBe(0)
  })

  test('the matrix reserves nothing for it', () => {
    const { display } = createTestEnvironment({
      displayConfig: { records: { show: true }, variantLayout: 'columns' },
    }).createDisplay()
    display.setCellData(recordsCellData(KIT), [0])

    expect(display.showRecords).toBe(false)
    expect(display.topBands.reserved.records).toBe(0)
    expect(display.rowsTopOffset).toBe(display.connectorsHeight)
  })
})

// the band's height over rows is the one it holds: a pan into more records or
// fewer fits them inside it, and moves nothing below the band
describe('a band keeps its height', () => {
  test('its first layout with a record holds its stack, writing nothing', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    expect(display.recordsHeightHeld).toBe(true)
    expect(display.recordsHeightWritten).toBe(false)
    expect(display.recordsHeight).toBe(naturalHeight())
  })

  test('a window with no record holds nothing, and spends nothing', () => {
    const { display } = recordsDisplayAt([], 51)
    expect(display.recordsHeightHeld).toBe(false)
    expect(display.topBands.reserved.records).toBe(0)

    display.setCellData(recordsCellData(KIT), [0])
    expect(display.recordsHeight).toBe(naturalHeight())
  })

  test('a pan into a denser or an empty window keeps it', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const settled = display.topBands.reserved.records
    const height = display.height

    display.setCellData(recordsCellData(NESTED), [0])
    expect(display.topBands.reserved.records).toBe(settled)
    expect(display.recordsHiddenCount).toBeGreaterThan(0)

    display.setCellData(recordsCellData([]), [0])
    expect(display.topBands.reserved.records).toBe(settled)
    expect(display.height).toBe(height)
  })

  // a held height equal to the default still holds: a dense window opens at
  // the default and keeps it on a pan to a sparse one
  test('a dense window opens at the default and keeps it', () => {
    const { display } = recordsDisplayAt(NESTED, 51, { mark: { height: 40 } })
    expect(display.recordsStackHeight).toBeGreaterThan(DEFAULT_RECORDS_HEIGHT)
    expect(display.recordsHeightHeld).toBe(true)
    expect(display.topBands.reserved.records).toBe(DEFAULT_RECORDS_HEIGHT)

    display.setCellData(recordsCellData(KIT), [0])
    expect(display.topBands.reserved.records).toBe(DEFAULT_RECORDS_HEIGHT)
  })

  test('a height set to the default holds', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    display.setRecordsHeight(DEFAULT_RECORDS_HEIGHT)
    expect(display.topBands.reserved.records).toBe(DEFAULT_RECORDS_HEIGHT)
  })

  test('with genotypes hidden a pan keeps it too', () => {
    const { display } = recordsDisplayAt(KIT, 51, {}, true, {
      genotypes: { show: false },
    })
    const settled = display.topBands.reserved.records
    expect(display.recordsHeightHeld).toBe(true)
    display.setCellData(recordsCellData([]), [0])
    expect(display.topBands.reserved.records).toBe(settled)
  })

  test('a written height holds over fewer records than fill it', () => {
    const { display } = recordsDisplayAt(KIT, 51, { height: 150 })
    expect(naturalHeight()).toBeLessThan(150)
    expect(display.topBands.reserved.records).toBe(150)
  })
})

describe('a resized band outlives the display instance', () => {
  test('a resize lands on the config', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    display.setRecordsHeight(64)

    expect(display.recordsHeight).toBe(64)
    expect(display.configuration.records.height).toBe(64)
    expect('records' in getSnapshot(display)).toBe(false)
  })

  test('a resize is floored, and stops where the rows keep their floor', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const height = display.height

    display.setRecordsHeight(0)
    expect(display.recordsHeight).toBe(MIN_RECORDS_HEIGHT)

    display.setRecordsHeight(1e6)
    expect(display.recordsHeight).toBe(
      height - BAND_CHIPS_HEIGHT - MIN_BAND_HEIGHT,
    )
    expect(display.availableHeight).toBe(MIN_BAND_HEIGHT)
    expect(display.height).toBe(height)
    expect(display.heightWritten).toBe(false)
  })
})

// a stack past the default, which the track's share then bounds
const TALL = { mark: { height: 40 } }

// more nested records than the band's share of a 290px track has rows for
const DEEP: BandRecord[] = Array.from({ length: 120 }, (_, i) => [
  `sv${i}`,
  1000 + i * 100,
  60000 - i * 100,
  '<DEL>',
  'DEL',
])

describe('`height` is the whole track while rows draw', () => {
  test('unset, it opens at the rows, chips and band defaults', () => {
    const { display } = recordsDisplayAt(NESTED, 51, TALL)
    expect(display.recordsStackHeight).toBeGreaterThan(DEFAULT_RECORDS_HEIGHT)
    expect(display.height).toBe(DEFAULT_ROWS_TRACK_HEIGHT)
    expect(display.topBands.reserved).toMatchObject({
      records: DEFAULT_RECORDS_HEIGHT,
      chips: BAND_CHIPS_HEIGHT,
    })
    expect(display.availableHeight).toBe(200)
  })

  test('written, the band and chips come out of it and the rows take the rest', () => {
    const { display } = recordsDisplayAt(NESTED, 51, TALL, true, {
      height: 290,
    })
    expect(display.height).toBe(290)
    expect(display.topBands.reserved.records).toBe(124)
    expect(display.availableHeight).toBe(146)
  })

  // the stack is what settles, so the share is free to give it back
  test('a track dragged taller gives an unwritten band back its stack', () => {
    const { display } = recordsDisplayAt(NESTED, 51, TALL, true, {
      height: 290,
    })
    expect(display.recordsHeightHeld).toBe(true)
    display.resizeHeight(100)
    expect(display.height).toBe(390)
    expect(display.topBands.reserved.records).toBe(DEFAULT_RECORDS_HEIGHT)
    expect(display.recordsHeightWritten).toBe(false)
  })

  test('a track dragged shorter shortens an unwritten band with it', () => {
    const { display } = recordsDisplayAt(NESTED, 51, TALL)
    display.resizeHeight(200 - display.height)
    expect(display.height).toBe(200)
    expect(display.topBands.reserved.records).toBe(83)
    expect(display.availableHeight).toBe(97)
  })

  test('a track dragged shut keeps the chips and the rows their floor', () => {
    const { display } = recordsDisplayAt(NESTED, 51, TALL)
    display.resizeHeight(-1000)
    expect(display.height).toBe(BAND_CHIPS_HEIGHT + MIN_BAND_HEIGHT)
    expect(display.topBands.reserved.records).toBe(0)
    expect(display.availableHeight).toBe(MIN_BAND_HEIGHT)
  })

  test('a written band keeps what it states, and is floored', () => {
    const stated = recordsDisplayAt(
      KIT,
      51,
      { height: DEFAULT_RECORDS_HEIGHT },
      true,
      { height: 290 },
    ).display
    expect(stated.topBands.reserved.records).toBe(DEFAULT_RECORDS_HEIGHT)
    expect(stated.availableHeight).toBe(100)
    const tiny = recordsDisplayAt(KIT, 51, { height: 2 }).display
    expect(tiny.topBands.reserved.records).toBe(MIN_RECORDS_HEIGHT)
  })

  test('a written band past the track leaves the rows their floor', () => {
    const { display } = recordsDisplayAt(KIT, 51, { height: 1e6 })
    expect(display.height).toBe(DEFAULT_ROWS_TRACK_HEIGHT)
    expect(display.availableHeight).toBe(MIN_BAND_HEIGHT)
    expect(display.topBands.reserved.records).toBe(
      DEFAULT_ROWS_TRACK_HEIGHT - BAND_CHIPS_HEIGHT - MIN_BAND_HEIGHT,
    )
  })

  // growing the band inside the box would leave a chip that still counts
  test('+N hidden raises the band to its stack and the track by as much', () => {
    const { display } = recordsDisplayAt(DEEP, 51, {}, true, { height: 290 })
    const stack = display.recordsStackHeight
    expect(display.topBands.reserved.records).toBe(124)
    expect(display.recordsHiddenCount).toBeGreaterThan(0)
    display.showAllRecordRows()
    expect(display.recordsHiddenCount).toBe(0)
    expect(display.configuration.records.height).toBe(stack)
    expect(display.topBands.reserved.records).toBe(stack)
    expect(display.height).toBe(290 + stack - 124)
    expect(display.availableHeight).toBe(146)
  })

  // 100 rows at 2 px want 200 px; the unwritten band takes its share of
  // every px the track gains until it reaches its stack
  test('the track edge double click grows to the rows under the band', () => {
    const { display } = recordsDisplayAt(NESTED, 51, TALL, true, {
      height: 200,
      rows: { step: 2 },
    })
    display.setSources(
      Array.from({ length: 100 }, (_, i) => ({ name: `S${i}` })),
    )
    expect(display.rowsContentHeight).toBe(200)
    expect(display.availableHeight).toBe(97)

    display.expandToContentHeight()
    expect(display.height).toBe(DEFAULT_ROWS_TRACK_HEIGHT)
    expect(display.availableHeight).toBe(200)
    expect(display.scrollableHeight).toBe(0)
    expect(display.expandToContentHeight()).toBe(0)
  })

  test('the double click under a written band grows by the rows it hides', () => {
    const { display } = recordsDisplayAt(KIT, 51, { height: 60 }, true, {
      height: 200,
      rows: { step: 2 },
    })
    display.setSources(
      Array.from({ length: 100 }, (_, i) => ({ name: `S${i}` })),
    )
    display.expandToContentHeight()
    expect(display.height).toBe(BAND_CHIPS_HEIGHT + 60 + 200)
    expect(display.scrollableHeight).toBe(0)
  })
})
