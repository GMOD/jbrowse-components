import { featureInfoOf } from '../../shared/cellData.fixture.ts'
import { cellGlyphs } from './cellGlyphs.ts'
import { SHAPE_RECT, SHAPE_TRI_LEFT } from './variantShape.ts'

test('the inversion triangle follows the SV class, not the SO type', () => {
  const featureInfo = [
    featureInfoOf('sequenceResolvedInv', {
      svType: 'INV',
      type: 'substitution',
    }),
    featureInfoOf('invDup', { svType: 'CPX', type: 'inversion' }),
    featureInfoOf('snv'),
  ]
  const { cellShapeTypes, cellPositions } = cellGlyphs({
    cellFeatureIndices: new Uint32Array([0, 1, 2, 0]),
    numCells: 4,
    featurePositions: new Uint32Array([100, 900, 200, 800, 300, 301]),
    featureInfo,
  })
  expect([...cellShapeTypes]).toEqual([
    SHAPE_TRI_LEFT,
    SHAPE_RECT,
    SHAPE_RECT,
    SHAPE_TRI_LEFT,
  ])
  expect([...cellPositions]).toEqual([100, 900, 200, 800, 300, 301, 100, 900])
})
