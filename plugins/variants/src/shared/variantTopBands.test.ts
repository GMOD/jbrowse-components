import { getSnapshot } from '@jbrowse/mobx-state-tree'

import regularConfigFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import regularStateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import matrixConfigFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'
import {
  DEFAULT_VARIANT_LANE_HEIGHT,
  MAX_VARIANT_LANE_HEIGHT,
  MIN_VARIANT_LANE_HEIGHT,
  variantTopBandsGeometry,
} from './variantTopBands.ts'

function regularDisplay() {
  const type = 'LinearMultiSampleVariantDisplay'
  const configSchema = regularConfigFactory()
  return regularStateModelFactory(configSchema).create({
    type,
    configuration: configSchema.create({ type, displayId: 'test-regular' }),
  })
}

function matrixDisplay() {
  const type = 'LinearMultiSampleVariantMatrixDisplay'
  const configSchema = matrixConfigFactory()
  return matrixStateModelFactory(configSchema).create({
    type,
    configuration: configSchema.create({ type, displayId: 'test-matrix' }),
  })
}

describe('the band stack', () => {
  // The lane is the topmost band and the connector zone sits under it, because
  // the lines in that zone END at genomic positions — which is exactly where
  // the lane draws. Reversing them would point the lines at the lane's bottom
  // edge instead of at the genome.
  test('stacks the lane above the connector zone', () => {
    expect(
      variantTopBandsGeometry({
        showVariantLane: true,
        variantLaneLabels: 'none',
        variantLaneHeight: 20,
        lineZoneHeight: 30,
      }),
    ).toEqual({
      laneTop: 0,
      laneHeight: 20,
      wantsName: false,
      wantsDescription: false,
      lineZoneTop: 20,
      bottom: 50,
    })
  })

  // Off spends nothing, not a clamped minimum: the toggle has to leave the
  // display pixel-identical to what it was before the lane existed, or every
  // committed figure carrying this display moves down by the floor.
  test('a lane that is off costs zero px, not its floor', () => {
    expect(
      variantTopBandsGeometry({
        showVariantLane: false,
        variantLaneLabels: 'none',
        variantLaneHeight: 20,
        lineZoneHeight: 30,
      }),
    ).toEqual({
      laneTop: 0,
      laneHeight: 0,
      wantsName: false,
      wantsDescription: false,
      lineZoneTop: 0,
      bottom: 30,
    })
  })

  // The stored height is honored whether or not it was written through the
  // clamped setter — a hand-edited config or an old session can carry anything,
  // and the geometry is what every painter reads.
  test('a stored height out of range is clamped at read time too', () => {
    const bands = (variantLaneHeight: number) =>
      variantTopBandsGeometry({
        showVariantLane: true,
        variantLaneLabels: 'none',
        variantLaneHeight,
        lineZoneHeight: 0,
      })

    expect(bands(0).laneHeight).toBe(MIN_VARIANT_LANE_HEIGHT)
    expect(bands(1e6).laneHeight).toBe(MAX_VARIANT_LANE_HEIGHT)
  })
})

describe('the band comes out of the rows, not out of the track', () => {
  test('turning the lane on shrinks the rows and leaves the height alone', () => {
    const d = regularDisplay()
    const height = d.height
    const before = d.availableHeight

    d.setShowVariantLane(true)

    expect(d.height).toBe(height)
    expect(d.rowsTopOffset).toBe(DEFAULT_VARIANT_LANE_HEIGHT)
    expect(d.availableHeight).toBe(before - DEFAULT_VARIANT_LANE_HEIGHT)
  })

  // Fit-to-height is the default row mode, so the rows genuinely re-divide what
  // is left rather than scrolling — this is the whole "takes its space from the
  // plot" claim, and it is what `autoRowHeight` reads.
  test('fit-to-height rows re-divide what is left', () => {
    const d = regularDisplay()
    const before = d.effectiveRowHeight

    d.setShowVariantLane(true)

    expect(d.effectiveRowHeight).toBeLessThan(before)
    expect(d.effectiveRowHeight).toBe(d.availableHeight / d.nrow)
  })

  // The reverse of the "every committed figure" argument for defaulting it off:
  // toggling back has to restore the exact previous geometry, not merely a
  // similar one.
  test('turning it back off restores the geometry exactly', () => {
    const d = regularDisplay()
    const before = {
      rowsTopOffset: d.rowsTopOffset,
      availableHeight: d.availableHeight,
      effectiveRowHeight: d.effectiveRowHeight,
    }

    d.setShowVariantLane(true)
    d.setVariantLaneHeight(64)
    d.setShowVariantLane(false)

    expect({
      rowsTopOffset: d.rowsTopOffset,
      availableHeight: d.availableHeight,
      effectiveRowHeight: d.effectiveRowHeight,
    }).toEqual(before)
  })
})

describe('the lane is the regular display alone', () => {
  // The base declares the geometry (every display's rows sit under whatever is
  // stacked on them) but the slots live on the display that can paint one. A
  // matrix that reserved a lane would take the height from its rows and leave
  // it blank, so it must answer 0 whatever a config says.
  test('the matrix reserves nothing for it', () => {
    const m = matrixDisplay()

    expect(m.showVariantLane).toBe(false)
    expect(m.topBands.laneHeight).toBe(0)
    // its own band is untouched, and is still the whole of its rows offset
    expect(m.rowsTopOffset).toBe(m.lineZoneHeight)
  })
})

describe('a resized lane outlives the display instance', () => {
  test('a drag lands on the config, like every other band', () => {
    const d = regularDisplay()
    d.setVariantLaneHeight(64)

    expect(d.variantLaneHeight).toBe(64)
    // on the config node, not the instance: the display can be destroyed and
    // recreated (untick/retick) and the band the user dragged comes back
    expect(d.configuration.variantLaneHeight).toBe(64)
    expect('variantLaneHeight' in getSnapshot(d)).toBe(false)
  })

  test('a drag is clamped by the shared band rule', () => {
    const d = regularDisplay()

    // the floor keeps the resize handle grabbable, so a band dragged shut can
    // be dragged back open
    d.setVariantLaneHeight(0)
    expect(d.variantLaneHeight).toBe(MIN_VARIANT_LANE_HEIGHT)

    d.setVariantLaneHeight(5000)
    expect(d.variantLaneHeight).toBe(MAX_VARIANT_LANE_HEIGHT)
  })
})
