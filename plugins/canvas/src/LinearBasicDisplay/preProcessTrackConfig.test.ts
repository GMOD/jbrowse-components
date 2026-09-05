import PluginManager from '@jbrowse/core/PluginManager'
import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'

import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'

type DisplaySnapshot = {
  type?: string
  geneGlyphMode?: string
  showLabels?: unknown
  color?: string
  connectorColor?: string
  utrColor?: string
  outlineColor?: string
  autoHeight?: boolean
  heightMode?: string
  height?: number
  maxHeight?: number
  featureHeight?: number
  renderer?: Record<string, unknown>
}
type TrackConfigSnapshot = {
  type?: string
  displays?: DisplaySnapshot[]
}

function evaluate(snap: TrackConfigSnapshot) {
  const pm = new PluginManager()
  addDisplayConfigMigration(
    pm,
    ['LinearBasicDisplay', 'LinearFeatureDisplay'],
    migrateBasicConfigSnapshot,
  )
  return pm.evaluateExtensionPoint(
    'Core-preProcessTrackConfig',
    snap,
  ) as TrackConfigSnapshot
}

test('remaps legacy geneGlyphMode "longest" before the display union validates', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', geneGlyphMode: 'longest' }],
  })
  expect(out.displays![0]!.geneGlyphMode).toBe('longestCoding')
})

test('normalizes a boolean showLabels to its enum mode', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', showLabels: true }],
  })
  expect(typeof out.displays![0]!.showLabels).toBe('string')
})

test('matches the LinearFeatureDisplay alias too', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearFeatureDisplay', geneGlyphMode: 'longest' }],
  })
  expect(out.displays![0]!.geneGlyphMode).toBe('longestCoding')
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
    color: 'green',
    connectorColor: 'gray',
    utrColor: 'lightblue',
    outlineColor: 'black',
  })
})

test('migrates legacy autoHeight:true to heightMode grow', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', autoHeight: true }],
  })
  expect(out.displays![0]!.heightMode).toBe('grow')
  expect(out.displays![0]!.autoHeight).toBeUndefined()
})

test('drops a legacy autoHeight:false without setting heightMode', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [{ type: 'LinearBasicDisplay', autoHeight: false }],
  })
  expect(out.displays![0]!.heightMode).toBeUndefined()
  expect(out.displays![0]!.autoHeight).toBeUndefined()
})

test('drops the retired maxHeight slot, from the display and the renderer', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      { type: 'LinearBasicDisplay', maxHeight: 600 },
      { type: 'LinearBasicDisplay', renderer: { maxHeight: 600 } },
    ],
  })
  expect(out.displays![0]!.maxHeight).toBeUndefined()
  expect(out.displays![1]!.maxHeight).toBeUndefined()
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
  expect(out.displays![0]!.color).toBe('red')
  expect(out.displays![0]!.renderer).toBeUndefined()
})

test('renderer.height becomes featureHeight, not the track height', () => {
  const out = evaluate({
    type: 'FeatureTrack',
    displays: [
      {
        type: 'LinearBasicDisplay',
        renderer: { type: 'SvgFeatureRenderer', height: 12 },
      },
    ],
  })
  expect(out.displays![0]!.featureHeight).toBe(12)
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
  expect(out.displays![0]!.featureHeight).toBe(12)
})
