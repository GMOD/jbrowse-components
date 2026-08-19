import { measureText } from '@jbrowse/core/util'

import { LABEL_EDGE_GUTTER_PX } from '../../RenderFeatureDataRPC/constants.ts'
import {
  LABEL_CULL_BUCKET_PX,
  computeLabelExtraWidth,
  forEachDisplayLabel,
  forEachRenderedLabel,
  labelCullBand,
} from './labelPositioning.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
  LabelItem,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  LabelCullBand,
  RegionWithData,
  ResolvedLabel,
} from './labelPositioning.ts'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

function makeLabel(overrides: Partial<LabelItem> = {}): LabelItem {
  return {
    text: 'NAME',
    relativeY: 4,
    color: 'black',
    textWidth: 30,
    ...overrides,
  }
}

function makeLabelData(
  featureId: string,
  overrides: Partial<FeatureLabelData> = {},
): FeatureLabelData {
  return {
    featureId,
    minX: 100,
    maxX: 200,
    topY: 0,
    featureHeight: 10,
    ...overrides,
  }
}

function makeData(labels: Record<string, FeatureLabelData>): FeatureDataResult {
  return { floatingLabelsData: labels } as FeatureDataResult
}

const FULL_REGION: BpRegionBounds = {
  start: 0,
  end: 1000,
  screenStartPx: 0,
  screenEndPx: 1000,
}

const LABEL_FONT = 11

function collect(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  visibility: {
    showLabels: boolean
    showDescriptions: boolean
    showSubfeatureLabels?: boolean
  },
  cullBand?: LabelCullBand,
) {
  const out: { featureId: string; labels: ResolvedLabel[] }[] = []
  forEachRenderedLabel(
    data,
    vr,
    { showSubfeatureLabels: true, ...visibility, fontSize: LABEL_FONT },
    (featureId, labels) => {
      out.push({ featureId, labels })
    },
    undefined,
    cullBand,
  )
  return out
}

describe('forEachRenderedLabel', () => {
  test('skips features whose bp span is outside the region', () => {
    const data = makeData({
      f1: makeLabelData('f1', { minX: 600, maxX: 700 }),
    })
    const result = collect(
      data,
      { ...FULL_REGION, start: 0, end: 500 },
      { showLabels: true, showDescriptions: true },
    )
    expect(result).toHaveLength(0)
  })

  test('does not emit when no labels would render', () => {
    const data = makeData({
      f1: makeLabelData('f1', { nameLabel: makeLabel() }),
    })
    const result = collect(data, FULL_REGION, {
      showLabels: false,
      showDescriptions: false,
    })
    expect(result).toHaveLength(0)
  })

  test('emits name + description with original relativeY when both shown', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        nameLabel: makeLabel({ text: 'name' }),
        descriptionLabel: makeLabel({ text: 'desc', relativeY: 12 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels.map(l => l.kind)).toEqual(['name', 'desc'])
    // description sits one label-line (the context font size) below the name,
    // regardless of the worker-supplied relativeY
    expect(emitted!.labels[1]!.label.relativeY).toBe(LABEL_FONT)
  })

  test('collapses description relativeY to 0 when name is hidden', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        nameLabel: makeLabel({ text: 'name' }),
        descriptionLabel: makeLabel({ text: 'desc', relativeY: 12 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: false,
      showDescriptions: true,
    })
    expect(emitted!.labels.map(l => l.kind)).toEqual(['desc'])
    expect(emitted!.labels[0]!.label.relativeY).toBe(0)
  })

  test('does not mutate the source descriptionLabel when collapsing', () => {
    const description = makeLabel({ text: 'desc', relativeY: 12 })
    const data = makeData({
      f1: makeLabelData('f1', {
        descriptionLabel: description,
      }),
    })
    collect(data, FULL_REGION, { showLabels: false, showDescriptions: true })
    expect(description.relativeY).toBe(12)
  })

  test('passes through subfeature label with isOverlay flag', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        subfeatureLabel: {
          ...makeLabel({ text: 'sub' }),
          isOverlay: true,
        },
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    const resolved = emitted!.labels[0]!
    if (resolved.kind === 'more') {
      throw new Error('expected the subfeature label, got the isoform badge')
    }
    expect(resolved.kind).toBe('sub')
    expect(resolved.label.isOverlay).toBe(true)
  })

  // A subfeature label outlives both feature-label flags — it is a worker-baked
  // config choice, not a fit rung — but not the fit squeeze, which scales the row
  // it was reserved in while the text keeps its font size.
  test('drops the subfeature label when the fit squeeze has hidden it', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        subfeatureLabel: { ...makeLabel({ text: 'sub' }), isOverlay: false },
      }),
    })
    expect(
      collect(data, FULL_REGION, {
        showLabels: false,
        showDescriptions: false,
      }),
    ).toHaveLength(1)
    expect(
      collect(data, FULL_REGION, {
        showLabels: false,
        showDescriptions: false,
        showSubfeatureLabels: false,
      }),
    ).toEqual([])
  })

  test('left-aligns labels wider than the feature', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        minX: 100,
        maxX: 110,
        nameLabel: makeLabel({ textWidth: 500 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels[0]!.labelX).toBe(100)
  })

  test('clamps left edge of label to screenStartPx when feature starts off-screen', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        minX: 0,
        maxX: 500,
        nameLabel: makeLabel({ textWidth: 30 }),
      }),
    })
    const [emitted] = collect(
      data,
      { ...FULL_REGION, screenStartPx: 50 },
      { showLabels: true, showDescriptions: true },
    )
    expect(emitted!.labels[0]!.labelX).toBeGreaterThanOrEqual(50)
  })

  // A gene wider than the window: the clamp is the only thing deciding where
  // its name goes, and at 0 it lands on the panel border.
  test('a feature running off the left holds its label inside the edge', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        minX: -400,
        maxX: 900,
        nameLabel: makeLabel({ textWidth: 30 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels[0]!.labelX).toBe(LABEL_EDGE_GUTTER_PX)
  })

  // and the gutter never outranks the right-edge clamp: a feature whose right
  // edge is within a label's width of the screen left keeps its label on that
  // right edge, off screen and all
  test('the right-edge clamp still wins over the gutter', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        minX: -400,
        maxX: 2,
        nameLabel: makeLabel({ textWidth: 30 }),
      }),
    })
    const [emitted] = collect(data, FULL_REGION, {
      showLabels: true,
      showDescriptions: true,
    })
    expect(emitted!.labels[0]!.labelX).toBeLessThan(LABEL_EDGE_GUTTER_PX)
  })

  test('culls a feature whose row is outside the cull band', () => {
    const data = makeData({
      near: makeLabelData('near', {
        topY: 100,
        nameLabel: makeLabel({ text: 'near' }),
      }),
      far: makeLabelData('far', {
        topY: 5000,
        nameLabel: makeLabel({ text: 'far' }),
      }),
    })
    const result = collect(
      data,
      FULL_REGION,
      { showLabels: true, showDescriptions: true },
      { top: 0, bottom: 400 },
    )
    expect(result.map(r => r.featureId)).toEqual(['near'])
  })

  test('keeps a feature within the cull band', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        topY: 300,
        nameLabel: makeLabel(),
      }),
    })
    const result = collect(
      data,
      FULL_REGION,
      { showLabels: true, showDescriptions: true },
      { top: 200, bottom: 700 },
    )
    expect(result).toHaveLength(1)
  })
})

describe('labelCullBand', () => {
  test('spans one bucket of margin on each side of the viewport', () => {
    const band = labelCullBand(0, 800)
    expect(band.top).toBe(-LABEL_CULL_BUCKET_PX)
    expect(band.bottom).toBe(800 + 2 * LABEL_CULL_BUCKET_PX)
  })

  test('covers the visible viewport for every scrollTop within a bucket', () => {
    const viewportHeight = 700
    const bucket = 3
    const band = labelCullBand(bucket, viewportHeight)
    // extremes of scrollTop that still map to this bucket
    const minScroll = bucket * LABEL_CULL_BUCKET_PX
    const maxScroll = (bucket + 1) * LABEL_CULL_BUCKET_PX
    expect(band.top).toBeLessThanOrEqual(minScroll)
    expect(band.bottom).toBeGreaterThanOrEqual(maxScroll + viewportHeight)
  })
})

describe('forEachDisplayLabel', () => {
  function regionWithData(displayedRegionIndex: number): RegionWithData {
    return { ...FULL_REGION, displayedRegionIndex }
  }

  test('emits a feature label once when it spans back-to-back regions', () => {
    // A collapsed-intron feature is laid out into both regions' data; its
    // label must be emitted a single time (the SVG-export duplication bug).
    const spanning = { f1: makeLabelData('f1', { nameLabel: makeLabel() }) }
    const laidOutDataMap = new Map([
      [0, makeData(spanning)],
      [1, makeData(spanning)],
    ])
    const emitted: string[] = []
    forEachDisplayLabel(
      [regionWithData(0), regionWithData(1)],
      laidOutDataMap,
      {
        showLabels: true,
        showDescriptions: true,
        showSubfeatureLabels: true,
        fontSize: LABEL_FONT,
      },
      featureId => {
        emitted.push(featureId)
      },
    )
    expect(emitted).toEqual(['f1'])
  })

  test('still emits distinct features from different regions', () => {
    const laidOutDataMap = new Map([
      [0, makeData({ f1: makeLabelData('f1', { nameLabel: makeLabel() }) })],
      [1, makeData({ f2: makeLabelData('f2', { nameLabel: makeLabel() }) })],
    ])
    const emitted: string[] = []
    forEachDisplayLabel(
      [regionWithData(0), regionWithData(1)],
      laidOutDataMap,
      {
        showLabels: true,
        showDescriptions: true,
        showSubfeatureLabels: true,
        fontSize: LABEL_FONT,
      },
      featureId => {
        emitted.push(featureId)
      },
    )
    expect(emitted.sort()).toEqual(['f1', 'f2'])
  })

  // Fit's `bodies` level hides labels upstream (model.renderedShowLabels /
  // renderedShowDescriptions both false), so the walker simply emits nothing.
  test('emits nothing when the caller has hidden every label kind', () => {
    const data = makeData({
      f1: makeLabelData('f1', {
        nameLabel: makeLabel(),
        descriptionLabel: makeLabel({ text: 'desc' }),
      }),
    })
    const emitted: string[] = []
    forEachDisplayLabel(
      [regionWithData(0)],
      new Map([[0, data]]),
      {
        showLabels: false,
        showDescriptions: false,
        showSubfeatureLabels: false,
        fontSize: LABEL_FONT,
      },
      featureId => {
        emitted.push(featureId)
      },
    )
    expect(emitted).toEqual([])
  })
})

describe('computeLabelExtraWidth', () => {
  function withLabels(texts: string[]): FeatureLabelData {
    const data = makeLabelData('feat1', { minX: 0, maxX: 100 })
    if (texts[0] !== undefined) {
      data.nameLabel = makeLabel({
        text: texts[0],
        relativeY: 0,
        textWidth: measureText(texts[0], LABEL_FONT),
      })
    }
    if (texts[1] !== undefined) {
      data.descriptionLabel = makeLabel({
        text: texts[1],
        relativeY: 0,
        textWidth: measureText(texts[1], LABEL_FONT),
      })
    }
    return data
  }

  test('returns positive extra width when label is wider than feature', () => {
    const labelWidth = measureText('BRCA1_longGeneName', LABEL_FONT)
    const result = computeLabelExtraWidth(withLabels(['BRCA1_longGeneName']), 2)
    expect(result).toBeCloseTo(labelWidth - 2)
    expect(result).toBeGreaterThan(0)
  })

  test('returns 0 when feature is wider than label', () => {
    expect(computeLabelExtraWidth(withLabels(['A']), 500)).toBe(0)
  })

  test('returns 0 when there are no labels', () => {
    expect(computeLabelExtraWidth(withLabels([]), 2)).toBe(0)
  })

  test('uses widest label when multiple labels exist', () => {
    const widest = measureText('LongLabelText_description', LABEL_FONT)
    const result = computeLabelExtraWidth(
      withLabels(['X', 'LongLabelText_description']),
      5,
    )
    expect(result).toBeCloseTo(widest - 5)
  })

  test('SNP-like feature (1bp, very narrow) gets large extra width', () => {
    const labelWidth = measureText('rs12345', LABEL_FONT)
    const result = computeLabelExtraWidth(withLabels(['rs12345']), 0.5)
    expect(result).toBeCloseTo(labelWidth - 0.5)
    expect(result).toBeGreaterThan(labelWidth - 1)
  })
})

// The invariant `renderedLabelSet` exists to hold: the horizontal room reserved
// for a feature's labels and the labels actually emitted are the same decision.
//
// Drift between them is silent and costs either a strip of reserved whitespace
// with no text in it, or a label overhanging the box the packer, the hit test
// and the SVG export all sized for it.
describe('the reservation and the ink agree', () => {
  const NAME = 'a-name-of-some-length'
  const DESC = 'a-description-that-is-much-longer-than-the-name'
  const SUB = 'sub'

  const sized = (text: string) => ({
    ...makeLabel({ text, textWidth: measureText(text, LABEL_FONT) }),
  })

  // Every subset of the three labels a feature can carry, so the subfeature
  // label's ungated-ness is exercised against both gates being off.
  const present = [
    { name: false, desc: false, sub: false },
    { name: true, desc: false, sub: false },
    { name: false, desc: true, sub: false },
    { name: false, desc: false, sub: true },
    { name: true, desc: true, sub: false },
    { name: true, desc: true, sub: true },
  ]

  test.each([
    { showLabels: true, showDescriptions: true },
    { showLabels: true, showDescriptions: false },
    { showLabels: false, showDescriptions: true },
    { showLabels: false, showDescriptions: false },
  ])(
    'showLabels=$showLabels showDescriptions=$showDescriptions',
    visibility => {
      for (const p of present) {
        const labelData = makeLabelData('f1', {
          nameLabel: p.name ? sized(NAME) : undefined,
          descriptionLabel: p.desc ? sized(DESC) : undefined,
          subfeatureLabel: p.sub
            ? { ...sized(SUB), isOverlay: false }
            : undefined,
        })
        const emitted = collect(
          makeData({ f1: labelData }),
          FULL_REGION,
          visibility,
        )
        const labels = emitted[0]?.labels ?? []
        // Measured against a zero-width feature, so the reservation IS the
        // widest rendered label rather than its overhang past a box.
        const reserved = computeLabelExtraWidth(
          labelData,
          0,
          visibility.showLabels,
          visibility.showDescriptions,
          LABEL_FONT,
        )

        // Nothing emitted <=> nothing reserved.
        expect(reserved > 0).toBe(labels.length > 0)
        // ...and when something is emitted, the reservation is exactly the
        // widest of the labels that were.
        if (labels.length > 0) {
          expect(reserved).toBeCloseTo(
            Math.max(...labels.map(l => l.label.textWidth)),
          )
        }
      }
    },
  )
})
