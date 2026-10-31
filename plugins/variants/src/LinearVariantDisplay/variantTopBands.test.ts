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
  DEFAULT_RECORDS_MAX_HEIGHT,
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
      lineZoneTop: 40,
      bottom: 70,
    })
  })

  test('a band that is off costs zero px, not its floor', () => {
    expect(geometry({ showRecords: false, lineZoneHeight: 30 })).toEqual({
      recordsHeight: 0,
      lineZoneTop: 0,
      bottom: 30,
    })
  })
})

describe('the band over rows', () => {
  const height = (recordsMaxHeight: number, recordsContentHeight: number) =>
    recordsBandHeightOverRows({ recordsMaxHeight, recordsContentHeight })

  test('a stack under the cap takes its own height', () => {
    expect(height(120, 37.2)).toBe(38)
  })

  test('a stack over the cap takes the cap', () => {
    expect(height(120, 400)).toBe(120)
  })

  test('a stated cap is floored, and has no ceiling but its stack', () => {
    expect(height(0, 400)).toBe(MIN_RECORDS_HEIGHT)
    expect(height(1e6, 1e5)).toBe(1e5)
  })

  test('a band with no records takes nothing', () => {
    expect(height(120, 0)).toBe(0)
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
    expect(natural).toBeLessThan(DEFAULT_RECORDS_MAX_HEIGHT)
    expect(display.topBands.recordsHeight).toBe(natural)
  })

  test('past the cap the fit ladder fits the stack into it', () => {
    const cap = 3 * GROUP_LABEL_HEIGHT
    const { display } = recordsDisplayAt(NESTED, 51, { maxHeight: cap })
    expect(display.topBands.recordsHeight).toBe(cap)
    expect(display.recordsFitStage.level).not.toBe('full')
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(cap)
  })

  // past the ladder's last rung over rows the band squeezes nothing: a
  // record that does not fit hides whole, and a chip at the band's foot
  // counts it
  test('past every rung a record that does not fit hides, counted', () => {
    const cap = 3 * GROUP_LABEL_HEIGHT
    const { display } = recordsDisplayAt(NESTED, 51, { maxHeight: cap })
    const placed = display.recordsPlacedHeight
    expect(display.topBands.recordsHeight).toBe(cap)
    expect(placed).toBe(cap - GROUP_LABEL_HEIGHT)
    expect(display.recordsHiddenCount).toBeGreaterThan(0)
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(placed)
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

  test('a band too short for the chip keeps its whole height for records', () => {
    const { display } = recordsDisplayAt(NESTED, 51, { maxHeight: 12 })
    expect(display.recordsHiddenCount).toBeGreaterThan(0)
    expect(display.recordsPlacedHeight).toBe(12)
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
    expect(display.rowsTopOffset).toBe(band)
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
    display.setRecordsMaxHeight(40)
    expect(display.rpcProps()).toEqual(key)
  })

  test('the key sits under the band, over the rows', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    expect(display.legendTop).toBe(display.topBands.recordsHeight)
    expect(display.legendTop).toBeGreaterThan(0)
    display.setShowRecords(false)
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

describe('a resized band outlives the display instance', () => {
  test('a resize lands on the config', () => {
    const { display } = createTestEnvironment().createDisplay()
    display.setRecordsMaxHeight(64)

    expect(display.recordsMaxHeight).toBe(64)
    expect(display.configuration.records.maxHeight).toBe(64)
    expect('records' in getSnapshot(display)).toBe(false)
  })

  test('a resize is floored by the shared band rule, and has no ceiling', () => {
    const { display } = createTestEnvironment().createDisplay()

    display.setRecordsMaxHeight(0)
    expect(display.recordsMaxHeight).toBe(MIN_RECORDS_HEIGHT)

    display.setRecordsMaxHeight(1e6)
    expect(display.recordsMaxHeight).toBe(1e6)
  })
})
