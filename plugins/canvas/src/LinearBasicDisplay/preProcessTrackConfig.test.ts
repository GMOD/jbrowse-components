import PluginManager from '@jbrowse/core/PluginManager'
import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'

import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'

interface DisplaySnapshot {
  type?: string
  geneGlyphMode?: string
  showLabels?: unknown
  color?: string
  connectorColor?: string
  utrColor?: string
  outlineColor?: string
  renderer?: Record<string, unknown>
}
interface TrackConfigSnapshot {
  type?: string
  displays?: DisplaySnapshot[]
}

// Mirrors the registration in ./index.ts. geneGlyphMode "longest" and a boolean
// showLabels are legacy values on existing enum slots, so they must be repaired
// before the display union validates the snapshot.
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

// v4.3.0 stored feature colors in the config under legacy color1/color2/color3/
// outline names — the sole path to preserve an old track's colors now.
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

// Pre-GPU-rewrite configs nested style slots under a `renderer` sub-config that
// no longer exists; they lift onto the display and the renderer key is dropped.
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
