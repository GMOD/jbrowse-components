import PluginManager from '@jbrowse/core/PluginManager'
import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'

import { migrateBasicConfigSnapshot } from './migrateBasicSnapshot.ts'

interface DisplaySnapshot {
  type?: string
  geneGlyphMode?: string
  showLabels?: unknown
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
