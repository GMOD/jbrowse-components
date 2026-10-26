import PluginManager from '@jbrowse/core/PluginManager'
import {
  getConfigurationSchemaMetadata,
  preProcessSnapshotWith,
} from '@jbrowse/core/configuration'
import { migrateRetiredDisplays } from '@jbrowse/core/pluggableElementTypes/models'

import registerLinearBasicDisplay from './index.ts'

type DisplaySnapshot = {
  type?: string
  geneGlyphMode?: string
  showLabels?: unknown
  labels?: unknown
  encoding?: { color?: { value?: string } }
  utrs?: unknown
  heightMode?: string
  height?: number
  maxHeight?: number
  mark?: { height?: number }
  renderer?: Record<string, unknown>
}
type TrackConfigSnapshot = {
  type?: string
  displays?: DisplaySnapshot[]
}

// The two passes a track config's displays go through: `migrateRetiredDisplays`
// loads an entry naming a retired display type as this one, and each entry then
// meets its own schema, whose `preProcessSnapshot` is where this display's
// legacy keys and values are rewritten.
function evaluate(snap: TrackConfigSnapshot) {
  const pm = new PluginManager()
  registerLinearBasicDisplay(pm)
  pm.createPluggableElements()
  const migrated = migrateRetiredDisplays(pm, snap) as TrackConfigSnapshot
  const meta = getConfigurationSchemaMetadata(
    pm.getDisplayType('LinearBasicDisplay').configSchema,
  )!
  return {
    ...migrated,
    displays: migrated.displays?.map(d =>
      d.type === 'LinearBasicDisplay' ? preProcessSnapshotWith(meta, d) : d,
    ),
  } as TrackConfigSnapshot
}

test('remaps legacy geneGlyphMode "longest"', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', geneGlyphMode: 'longest' }],
  })
  expect(out.displays![0]!.geneGlyphMode).toBe('representative')
})

test('lifts a v4 boolean showLabels onto labels.name.show', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', showLabels: false }],
  })
  expect(out.displays![0]!.showLabels).toBeUndefined()
  expect(out.displays![0]!.labels).toEqual({ name: { show: false } })
})

test('matches the LinearFeatureDisplay alias too', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearFeatureDisplay', geneGlyphMode: 'longest' }],
  })
  expect(out.displays![0]!.geneGlyphMode).toBe('representative')
})

test('leaves non-canvas displays untouched', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'SomeOtherDisplay', geneGlyphMode: 'longest' }],
  })
  expect(out.displays![0]!.geneGlyphMode).toBe('longest')
})

test('renames legacy color1/color2/color3/outline config slots', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      {
        type: 'LinearBasicDisplay',
        // @ts-expect-error legacy names not on DisplaySnapshot
        color1: 'green',
        color2: 'gray',
        color3: 'lightblue',
        outline: 'black',
      },
    ],
  })
  expect(out.displays![0]).toMatchObject({
    encoding: { color: { value: 'green' } },
    utrs: { encoding: { color: { value: 'lightblue' } } },
  })
  expect(out.displays![0]).not.toHaveProperty('outline')
  expect(out.displays![0]).not.toHaveProperty('color2')
})

test.each([
  { type: 'LinearBasicDisplay', maxHeight: 600 },
  { type: 'LinearBasicDisplay', renderer: { maxHeight: 600 } },
])('drops the retired maxHeight slot from %j', display => {
  const out = evaluate({ type: 'FeatureTrack', displays: [display] })
  expect(out.displays![0]!.maxHeight).toBeUndefined()
})

test.each([
  { type: 'LinearBasicDisplay', hideSourceFeatures: false },
  { type: 'LinearBasicDisplay', renderer: { hideSourceFeatures: false } },
])('drops the retired hideSourceFeatures slot from %j', display => {
  const out = evaluate({ type: 'FeatureTrack', displays: [display] })
  expect(out.displays![0]).not.toHaveProperty('hideSourceFeatures')
})

test('lifts style slots out of the old renderer sub-config', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      {
        type: 'LinearBasicDisplay',
        renderer: { type: 'SvgFeatureRenderer', color1: 'red' },
      },
    ],
  })
  expect(out.displays![0]!.encoding).toEqual({ color: { value: 'red' } })
  expect(out.displays![0]!.renderer).toBeUndefined()
})

test('renderer.height becomes mark.height, not the track height', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      {
        type: 'LinearBasicDisplay',
        renderer: { type: 'SvgFeatureRenderer', height: 12 },
      },
    ],
  })
  expect(out.displays![0]!.mark).toEqual({ height: 12 })
  expect(out.displays![0]!.height).toBeUndefined()
})

test('a display height alongside renderer.height keeps both meanings', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      {
        type: 'LinearBasicDisplay',
        height: 200,
        renderer: { type: 'SvgFeatureRenderer', height: 12 },
      },
    ],
  })
  expect(out.displays![0]!.height).toBe(200)
  expect(out.displays![0]!.mark).toEqual({ height: 12 })
})

test("a v4 renderer's per-feature height callback drops rather than failing the track", () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      {
        type: 'LinearBasicDisplay',
        renderer: {
          type: 'CanvasFeatureRenderer',
          height: "jexl:get(feature,'type')=='gene'?20:8",
        },
      },
    ],
  })
  expect(out.displays![0]!.mark).toBeUndefined()
})
