import { MIN_BAND_HEIGHT } from '@jbrowse/core/util/bandHeight'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import ldTrackDisplayConfigSchema from '../LDDisplay/configSchemaLDTrack.ts'
import { createTestEnvironment } from '../LDDisplay/testEnv.ts'
import regularConfigFactory from '../LinearVariantDisplay/configSchema.ts'
import regularStateModelFactory from '../LinearVariantDisplay/model.ts'
import { retiredState } from '../LinearVariantDisplay/retired.ts'
import { createTestEnvironment as createVariantTestEnvironment } from '../LinearVariantDisplay/testEnv.ts'

// The `connectors` band is one contract across both displays that draw it: a
// `{ show, height }` config band (so a drag survives the track being unticked
// and reticked), read through one getter, written by one clamped setter, and
// taken from the plot under it, which keeps its floor.
function variantDisplay(conf: Record<string, unknown> = {}) {
  const type = 'LinearVariantDisplay'
  const configSchema = regularConfigFactory()
  return regularStateModelFactory(configSchema).create({
    type,
    configuration: configSchema.create({
      type,
      displayId: 'test-variant',
      ...conf,
    }),
  })
}

const columns = (conf: Record<string, unknown> = {}) =>
  variantDisplay({ variantLayout: 'columns', ...conf })

// in a view, with one sample drawing as a row
function columnsInView(conf: Record<string, unknown> = {}) {
  const { display } = createVariantTestEnvironment({
    displayConfig: {
      variantLayout: 'columns',
      genotypes: { show: true },
      ...conf,
    },
  }).createDisplay()
  display.setSources([{ name: 'S0' }])
  return display
}

test('only the index-laid-out layouts reserve the band', () => {
  expect(variantDisplay().connectorsHeight).toBe(0)
  expect(columns().connectorsHeight).toBe(20)
  expect(createTestEnvironment().createDisplay().display.connectorsHeight).toBe(
    100,
  )
})

test('show off reserves nothing, and the height comes back with it', () => {
  const m = columns({ connectors: { show: false, height: 60 } })
  expect(m.connectorsHeight).toBe(0)
  const { display: ld } = createTestEnvironment({
    displayConfig: { connectors: { show: false } },
  }).createDisplay()
  expect(ld.matrixTop).toBe(0)
  expect(columns({ connectors: { height: 60 } }).connectorsHeight).toBe(60)
})

// Genomic-positions mode draws no connector lines, so LD reserves only what is
// switched on. Labels used to get nothing at all and rendered over the triangle.
test('LD reserves the genomic-positions band for its names', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setVariantLayout('genomic')

  expect(display.matrixTop).toBe(0)

  display.setShowNames(true)
  expect(display.matrixTop).toBe(display.connectorsHeight)
  // the room for the rotated labels is the user's to drag rather than
  // something measured off the text
  display.setConnectorsHeight(140)
  expect(display.matrixTop).toBe(140)

  display.setShowNames(false)
  expect(display.matrixTop).toBe(0)
})

test('a resize lands on the config, so it outlives the display instance', () => {
  const m = columns()
  m.setConnectorsHeight(60)

  expect(m.connectorsHeight).toBe(60)
  expect(m.configuration.connectors.height).toBe(60)
  expect('connectors' in getSnapshot(m)).toBe(false)
})

test('a drag stops at the handle floor and where the plot keeps its own', () => {
  const m = columnsInView()
  const { display: ld } = createTestEnvironment().createDisplay()

  m.setConnectorsHeight(0)
  ld.setConnectorsHeight(0)
  expect(m.connectorsHeight).toBe(10)
  expect(ld.connectorsHeight).toBe(10)

  m.setConnectorsHeight(5000)
  ld.setConnectorsHeight(5000)
  expect(m.connectorsHeight).toBe(m.height - MIN_BAND_HEIGHT)
  expect(ld.connectorsHeight).toBe(ld.height - MIN_BAND_HEIGHT)
})

// a fixed 1000 px ceiling let a drag below the track's edge, or a config taller
// than it, take the genotype rows to 0 px with the handle out of reach
test('a stated height past the plot leaves the rows their floor', () => {
  const m = columnsInView({ height: 150, connectors: { height: 400 } })
  expect(m.connectorsHeight).toBe(150 - MIN_BAND_HEIGHT)
  expect(m.availableHeight).toBe(MIN_BAND_HEIGHT)
  const { display: ld } = createTestEnvironment({
    displayConfig: { height: 150, connectors: { height: 400 } },
  }).createDisplay()
  expect(ld.matrixTop).toBe(150 - MIN_BAND_HEIGHT)
})

// `lineZoneHeight` shipped as an LD config slot and as v4's matrix session
// state, 0 turning the zone off
test("v4's lineZoneHeight lifts into the band", () => {
  const make = (snap: Record<string, unknown>) =>
    ldTrackDisplayConfigSchema().create({
      type: 'LDTrackDisplay',
      displayId: 'ld-test',
      ...snap,
    })
  expect(make({ lineZoneHeight: 140 }).connectors.height).toBe(140)
  expect(make({ lineZoneHeight: 0 }).connectors.show).toBe(false)
  expect(retiredState.keys).toContain('lineZoneHeight')
  expect(
    retiredState.lift({
      type: 'LinearVariantMatrixDisplay',
      lineZoneHeight: 45,
    }),
  ).toMatchObject({ connectors: { height: 45 } })
})
