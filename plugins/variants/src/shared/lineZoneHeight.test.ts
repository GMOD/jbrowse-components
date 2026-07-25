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
