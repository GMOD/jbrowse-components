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
  MIN_RECORDS_HEIGHT,
  recordsBandHeightOverRows,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

import type { BandRecord } from './recordsBand.fixture.ts'

function geometry(
  over: Partial<Parameters<typeof variantTopBandsGeometry>[0]>,
) {
  return variantTopBandsGeometry({
    showRecords: true,
    recordsHeight: 40,
    showChips: false,
    lineZoneHeight: 0,
    ...over,
  })
}

describe('the band stack', () => {
  // the connector lines end at genomic positions, which is where the records
  // draw, so the records sit above the zone
  test('stacks the records above the connector zone', () => {
    expect(geometry({ lineZoneHeight: 30 })).toEqual({
      recordsHeight: 40,
      chipsHeight: 0,
      lineZoneTop: 40,
      bottom: 70,
    })
  })

  // the rows' tree, facet strip and labels draw over their left edge, so the
  // chips take a strip of their own between the band and the rows
  test('the chips take a strip under the records', () => {
    expect(geometry({ showChips: true })).toEqual({
      recordsHeight: 40,
      chipsHeight: BAND_CHIPS_HEIGHT,
      lineZoneTop: 40 + BAND_CHIPS_HEIGHT,
      bottom: 40 + BAND_CHIPS_HEIGHT,
    })
  })

  test('a band that is off costs zero px, not its floor', () => {
    expect(geometry({ showRecords: false, lineZoneHeight: 30 })).toEqual({
      recordsHeight: 0,
      chipsHeight: 0,
      lineZoneTop: 0,
      bottom: 30,
    })
  })
})

describe('the band over rows', () => {
  const unwritten = (recordsHeight: number, recordsContentHeight: number) =>
    recordsBandHeightOverRows({
      recordsHeight,
      recordsHeightWritten: false,
      recordsContentHeight,
    })
  const written = (recordsHeight: number, recordsContentHeight: number) =>
    recordsBandHeightOverRows({
      recordsHeight,
      recordsHeightWritten: true,
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

  test('a written height is floored, and has no ceiling', () => {
    expect(written(0, 400)).toBe(MIN_RECORDS_HEIGHT)
    expect(written(1e6, 10)).toBe(1e6)
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
    expect(display.topBands.recordsHeight).toBe(natural)
  })

  test('past its height the fit ladder fits the stack into it', () => {
    const cap = 3 * GROUP_LABEL_HEIGHT
    const { display } = recordsDisplayAt(NESTED, 51, { height: cap })
    expect(display.topBands.recordsHeight).toBe(cap)
    expect(display.recordsFitStage.level).not.toBe('full')
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(cap)
  })

  // past the ladder's last rung over rows the band squeezes nothing: a
  // record that does not fit hides whole, counted for the chip beside the
  // band
  test('past every rung a record that does not fit hides, counted', () => {
    const cap = 3 * GROUP_LABEL_HEIGHT
    const { display } = recordsDisplayAt(NESTED, 51, { height: cap })
    expect(display.topBands.recordsHeight).toBe(cap)
    expect(display.recordsHiddenCount).toBeGreaterThan(0)
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(cap)
    const hidden = display.recordsLaidOutDataMap
      .get(0)!
      .flatbushItems.filter(i => i.topPx < 0)
    expect(hidden).toHaveLength(display.recordsHiddenCount)
    expect(display.searchFeatureByID(hidden[0]!.featureId)).toBeUndefined()

    display.showAllRecordRows()
    expect(display.recordsHiddenCount).toBe(0)
    expect(display.topBands.recordsHeight).toBe(display.recordsStackHeight)
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

  test('turning the band on adds its height to the track, not the rows', () => {
    const { display } = recordsDisplayAt(KIT, 51, { show: false })
    const height = display.height
    const before = {
      rowsTopOffset: display.rowsTopOffset,
      availableHeight: display.availableHeight,
      effectiveRowHeight: display.effectiveRowHeight,
    }

    display.setShowRecords(true)
    const band = display.topBands.recordsHeight
    expect(band).toBeGreaterThan(0)
    expect(display.height).toBe(height + band)
    expect(display.rowsTopOffset).toBe(band + BAND_CHIPS_HEIGHT)
    expect(display.availableHeight).toBe(before.availableHeight)

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
    expect(display.topBands.recordsHeight).toBeGreaterThan(0)
    expect(display.legendTop).toBe(0)
  })

  test('the matrix reserves nothing for it', () => {
    const { display } = createTestEnvironment({
      displayConfig: { records: { show: true }, variantLayout: 'columns' },
    }).createDisplay()
    display.setCellData(recordsCellData(KIT), [0])

    expect(display.showRecords).toBe(false)
    expect(display.topBands.recordsHeight).toBe(0)
    expect(display.rowsTopOffset).toBe(display.lineZoneHeight)
  })
})

// the band's height over rows is the one written: a pan into more records or
// fewer fits them inside it, and moves nothing below the band
describe('a band keeps its height', () => {
  test('its first layout with a record writes its stack', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    expect(display.recordsHeightWritten).toBe(true)
    expect(display.recordsHeight).toBe(naturalHeight())
  })

  test('a window with no record writes nothing, and spends nothing', () => {
    const { display } = recordsDisplayAt([], 51)
    expect(display.recordsHeightWritten).toBe(false)
    expect(display.topBands.recordsHeight).toBe(0)

    display.setCellData(recordsCellData(KIT), [0])
    expect(display.recordsHeight).toBe(naturalHeight())
  })

  test('a pan into a denser or an empty window keeps it', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const settled = display.topBands.recordsHeight
    const height = display.height

    display.setCellData(recordsCellData(NESTED), [0])
    expect(display.topBands.recordsHeight).toBe(settled)
    expect(display.recordsHiddenCount).toBeGreaterThan(0)

    display.setCellData(recordsCellData([]), [0])
    expect(display.topBands.recordsHeight).toBe(settled)
    expect(display.height).toBe(height)
  })

  // a written height equal to the default is still written: a dense window
  // opens at the default and keeps it on a pan to a sparse one
  test('a dense window opens at the default and keeps it', () => {
    const { display } = recordsDisplayAt(NESTED, 51, { mark: { height: 40 } })
    expect(display.recordsStackHeight).toBeGreaterThan(DEFAULT_RECORDS_HEIGHT)
    expect(display.recordsHeightWritten).toBe(true)
    expect(display.topBands.recordsHeight).toBe(DEFAULT_RECORDS_HEIGHT)

    display.setCellData(recordsCellData(KIT), [0])
    expect(display.topBands.recordsHeight).toBe(DEFAULT_RECORDS_HEIGHT)
  })

  test('a height set to the default holds', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    display.setRecordsHeight(DEFAULT_RECORDS_HEIGHT)
    expect(display.topBands.recordsHeight).toBe(DEFAULT_RECORDS_HEIGHT)
  })

  test('with genotypes hidden a pan keeps it too', () => {
    const { display } = recordsDisplayAt(KIT, 51, {}, true, {
      genotypes: { show: false },
    })
    const settled = display.topBands.recordsHeight
    expect(display.recordsHeightWritten).toBe(true)
    display.setCellData(recordsCellData([]), [0])
    expect(display.topBands.recordsHeight).toBe(settled)
  })

  test('a written height holds over fewer records than fill it', () => {
    const { display } = recordsDisplayAt(KIT, 51, { height: 150 })
    expect(naturalHeight()).toBeLessThan(150)
    expect(display.topBands.recordsHeight).toBe(150)
  })
})

describe('a resized band outlives the display instance', () => {
  test('a resize lands on the config', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRecordsHeight(64)

    expect(display.recordsHeight).toBe(64)
    expect(display.configuration.records.height).toBe(64)
    expect('records' in getSnapshot(display)).toBe(false)
  })

  test('a resize is floored by the shared band rule, and has no ceiling', () => {
    const { display } = createTestEnvironment().createDisplay()

    display.setRecordsHeight(0)
    expect(display.recordsHeight).toBe(MIN_RECORDS_HEIGHT)

    display.setRecordsHeight(1e6)
    expect(display.recordsHeight).toBe(1e6)
  })
})
