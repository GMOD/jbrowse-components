import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from '../LDDisplay/testEnv.ts'
import regularConfigFactory from '../LinearMultiSampleVariantDisplay/configSchema.ts'
import regularStateModelFactory from '../LinearMultiSampleVariantDisplay/model.ts'
import matrixConfigFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'

// The connector-line zone is one contract across every display that draws it: a
// `lineZoneHeight` **config slot** (so a drag survives the track being unticked
// and reticked, like `height` — see TrackHeightMixin), read through one getter,
// written by one clamped `setSlot` setter. These lock that down; the two display
// families used to disagree — LD on a slot, the matrix on a bespoke instance
// property with its own clamp — which is how their setters drifted.
function matrixDisplay() {
  const type = 'LinearMultiSampleVariantMatrixDisplay'
  const configSchema = matrixConfigFactory()
  return matrixStateModelFactory(configSchema).create({
    type,
    configuration: configSchema.create({ type, displayId: 'test-matrix' }),
  })
}

function regularDisplay() {
  const type = 'LinearMultiSampleVariantDisplay'
  const configSchema = regularConfigFactory()
  return regularStateModelFactory(configSchema).create({
    type,
    configuration: configSchema.create({ type, displayId: 'test-regular' }),
  })
}

test('only the index-laid-out displays reserve a zone', () => {
  // the regular display draws each variant at its genomic position, so it has
  // no columns to connect and takes the shared slot's 0 default
  expect(regularDisplay().lineZoneHeight).toBe(0)
  // the matrix redeclares that slot to raise the default
  expect(matrixDisplay().lineZoneHeight).toBe(20)
  expect(createTestEnvironment().createDisplay().display.lineZoneHeight).toBe(
    100,
  )
})

// Genomic-positions mode draws no connector lines, so it reserves only what is
// switched on. Labels used to get nothing at all and rendered over the triangle.
test('LD reserves the genomic-positions zone for whatever is switched on', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setUseGenomicPositions(true)

  expect(display.effectiveLineZoneHeight).toBe(0)

  display.setShowLabels(true)
  expect(display.effectiveLineZoneHeight).toBe(display.lineZoneHeight)
  // and that band is the draggable one, so the room for the rotated labels is
  // the user's to set rather than something we measure text extents for
  display.setLineZoneHeight(140)
  expect(display.effectiveLineZoneHeight).toBe(140)

  // off again spends 0 px, so switching labels on and back off leaves the
  // triangle exactly the size it was
  display.setShowLabels(false)
  expect(display.effectiveLineZoneHeight).toBe(0)
})

test('a resize lands on the config, so it outlives the display instance', () => {
  const m = matrixDisplay()
  m.setLineZoneHeight(60)

  expect(m.lineZoneHeight).toBe(60)
  // on the config node, not the instance: the display can be destroyed and
  // recreated (untick/retick) and the zone the user dragged comes back
  expect(m.configuration.lineZoneHeight).toBe(60)
  expect('lineZoneHeight' in getSnapshot(m)).toBe(false)
})

test('the matrix clamps a drag exactly as LD does', () => {
  const m = matrixDisplay()
  const { display: ld } = createTestEnvironment().createDisplay()

  // the floor keeps the resize handle (drawn at lineZoneHeight - 4) grabbable,
  // so a zone dragged shut can be dragged back open
  m.setLineZoneHeight(0)
  ld.setLineZoneHeight(0)
  expect(m.lineZoneHeight).toBe(10)
  expect(ld.lineZoneHeight).toBe(10)

  m.setLineZoneHeight(5000)
  ld.setLineZoneHeight(5000)
  expect(m.lineZoneHeight).toBe(1000)
  expect(ld.lineZoneHeight).toBe(1000)
})

// `ConnectorLineOverlay` draws the zone from y=0 down to the raw
// `lineZoneHeight` slot, where `topBands` is the resolved band geometry — the
// exact substitution `variantTopBands.ts` exists to prevent. It is right today
// only because the matrix stacks no variant lane above the zone, so the zone IS
// the top band and the two numbers agree. Pinned here rather than left as a
// comment: giving the matrix a lane turns this red, which is the moment the
// overlay has to start reading `lineZoneTop` instead of drawing from zero.
test('the matrix connector zone is the topmost band, which is what lets the overlay draw from zero', () => {
  const m = matrixDisplay()

  expect(m.topBands.laneHeight).toBe(0)
  expect(m.topBands.lineZoneTop).toBe(0)
  expect(m.topBands.bottom).toBe(m.lineZoneHeight)
})
