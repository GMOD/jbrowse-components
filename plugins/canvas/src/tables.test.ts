import { OFFSCREEN_Y } from './LinearBasicDisplay/rowPlacement.ts'
import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
  makeSubfeatureInfo,
  packFixtureRects,
} from './RenderFeatureDataRPC/testUtils.ts'
import { laidOutTables } from './tables.ts'

const LABELS = {
  showLabels: true,
  showDescriptions: false,
  showSubfeatureLabels: false,
  fontSize: 11,
  colors: {
    name: '#000000',
    description: '#000000',
    more: '#000000',
    subfeature: '#000000',
    subfeatureOverlay: '#000000',
  },
}

// The packer left the first feature past its row ceiling; the second is on
// row 0 behind it, so every index into `features` has to move down by one.
test('a feature the packer could not place leaves every table and is counted', () => {
  const span = { startBp: 0, endBp: 100 }
  const d = makeFeatureData({
    ...packFixtureRects([span, span]),
    flatbushItems: [
      makeFlatbushItem({
        featureId: 'lost',
        ...span,
        topPx: OFFSCREEN_Y,
        bottomPx: OFFSCREEN_Y + 10,
      }),
      makeFlatbushItem({ featureId: 'kept', ...span, name: 'KEPT' }),
    ],
    subfeatureInfos: [
      makeSubfeatureInfo({ featureId: 'lost.1', parentFeatureId: 'lost' }),
      makeSubfeatureInfo({ featureId: 'kept.1', parentFeatureId: 'kept' }),
    ],
    floatingLabelsData: labelsMap({
      kept: {
        featureId: 'kept',
        minX: 0,
        maxX: 100,
        topY: 0,
        featureHeight: 10,
        nameLabel: { text: 'KEPT', relativeY: 0, textWidth: 30 },
      },
    }),
  })
  const t = laidOutTables(d, {
    region: { start: 0, end: 1000 },
    widthPx: 1000,
    bpPerPx: 1,
    hideChevrons: false,
    labels: LABELS,
  })
  expect(t.truncated).toBe(1)
  expect(t.features.id).toEqual(['kept'])
  expect(t.subfeatures.id).toEqual(['kept.1'])
  expect(t.subfeatures.feature).toEqual([0])
  expect(t.rects.feature).toEqual([0])
  expect(t.labels.text).toEqual(['KEPT'])
  expect(t.labels.feature).toEqual([0])
  expect(t.height).toBe(10)
})
