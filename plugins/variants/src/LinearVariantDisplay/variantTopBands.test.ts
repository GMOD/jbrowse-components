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
  variantTopBandsGeometry,
} from './variantTopBands.ts'

function geometry(
  over: Partial<Parameters<typeof variantTopBandsGeometry>[0]>,
) {
  return variantTopBandsGeometry({
    showRecords: true,
    recordsOnly: false,
    displayHeight: 500,
    recordsMaxHeight: 120,
    recordsContentHeight: 40,
    recordsBounds: { min: MIN_RECORDS_HEIGHT, max: 500 },
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

  test('a stack under the cap takes its own height', () => {
    expect(geometry({ recordsContentHeight: 37.2 }).recordsHeight).toBe(38)
  })

  test('a stack over the cap takes the cap', () => {
    expect(geometry({ recordsContentHeight: 400 }).recordsHeight).toBe(120)
  })

  test('a stated cap out of range is bound at read time', () => {
    expect(
      geometry({ recordsMaxHeight: 0, recordsContentHeight: 400 })
        .recordsHeight,
    ).toBe(MIN_RECORDS_HEIGHT)
    expect(
      geometry({ recordsMaxHeight: 1e6, recordsContentHeight: 1e5 })
        .recordsHeight,
    ).toBe(500)
  })

  test('a band with no records takes nothing', () => {
    expect(geometry({ recordsContentHeight: 0 }).recordsHeight).toBe(0)
  })
})

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
    const cap = Math.floor(naturalHeight() / 2)
    const { display } = recordsDisplayAt(KIT, 51, { maxHeight: cap })
    expect(display.topBands.recordsHeight).toBe(cap)
    expect(display.recordsFitStage.level).not.toBe('full')
    expect(maxBottom(display.recordsLaidOutDataMap)).toBeLessThanOrEqual(cap)
  })

  test('turning the band on takes its height from the rows, not the track', () => {
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
    expect(display.height).toBe(height)
    expect(display.rowsTopOffset).toBe(band)
    expect(display.availableHeight).toBe(before.availableHeight - band)

    display.setShowRecords(false)
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

  test('a resize is clamped by the shared band rule', () => {
    const { display } = createTestEnvironment().createDisplay()

    display.setRecordsMaxHeight(0)
    expect(display.recordsMaxHeight).toBe(MIN_RECORDS_HEIGHT)

    display.setRecordsMaxHeight(1e6)
    expect(display.recordsMaxHeight).toBeLessThan(display.height)
  })
})
