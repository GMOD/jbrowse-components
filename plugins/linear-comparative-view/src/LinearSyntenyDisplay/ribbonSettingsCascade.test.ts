import { setConf } from '@jbrowse/core/configuration'
import { abgrAlpha } from '@jbrowse/core/util/colorBits'
import { createTestSession } from '@jbrowse/web/testUtils'

import { KIND_BASE, KIND_MARKER } from '../LinearSyntenyRPC/syntenyColors.ts'
import { packSyntenyFeatureData } from './testUtils.ts'

import type { SyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'
import type { LinearSyntenyDisplayModel } from './model.ts'

// `drawCurves` and `drawLocationMarkers` are promotable slots on
// LinearSyntenyDisplay read through `effectiveDrawCurves` /
// `effectiveDrawLocationMarkers`, and this is the file that pins what those
// getters resolve.
//
// **The pin's existence is a different question, and it already has a check.**
// `PromotablePinCoverage` (jbrowse-web) walks the view's settings menu and fails
// if either slot has no pin on it. What it cannot see is whether the value that
// pin writes reaches a ribbon: replace both `resolveConf` calls with the literal
// `false` and every suite in the repo stays green, because the only other
// assertions on these getters — `initHelpers.test.ts` and
// `SyntenySettingsMenu.test.tsx` — expect `false`, which is exactly the
// `promotedBase` a dropped cascade returns. So a slot could be promotable in the
// schema, pinned on the menu, documented on the config page, and inert.
//
// `renderParams` needs no assertion here: its `drawCurves` is typed `boolean`,
// so tsc refuses the raw `view.drawCurves` the getter replaced.
// `computeSyntenyColors` takes `drawLocationMarkers` optionally and has no such
// guard, so the marker lane is asserted through the display below rather than
// through the color function, which is already covered on its own inputs.

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = (name: string) => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: `${name}-ctgA`,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        },
      ],
    },
  },
})

// Two rows with no displayed regions: the cascade is a config read, so nothing
// here needs an initialized viewport, and a level with no regions starts no
// fetch to leave in flight at teardown.
function openPair() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addTrackConf({
    type: 'SyntenyTrack',
    trackId: 'pair',
    name: 'pair',
    assemblyNames: ['volvox', 'volvox2'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox',
      targetAssembly: 'volvox2',
    },
  })
  const view = session.addView('LinearSyntenyView', {
    views: [{ type: 'LinearGenomeView' }, { type: 'LinearGenomeView' }],
  }) as LinearSyntenyViewModel
  view.showTrack('pair')
  return {
    session,
    view,
    display: view.allSyntenyDisplays[0] as LinearSyntenyDisplayModel,
  }
}

test('unset at every tier resolves to the slot promotedBase', () => {
  const { view, display } = openPair()
  expect(display.effectiveDrawCurves).toBe(false)
  expect(display.effectiveDrawLocationMarkers).toBe(false)
  expect(view.effectiveDrawCurves).toBe(false)
  expect(view.effectiveDrawLocationMarkers).toBe(false)
})

// What the pin writes. The view's getters read the cascade off the first synteny
// display, so a promoted default has to move both or the checkbox and the
// ribbons disagree.
test('the session-wide default reaches the display and the view', () => {
  const { session, view, display } = openPair()
  session.setDisplayTypeDefault('LinearSyntenyDisplay', 'drawCurves', true)
  session.setDisplayTypeDefault(
    'LinearSyntenyDisplay',
    'drawLocationMarkers',
    true,
  )
  expect(display.effectiveDrawCurves).toBe(true)
  expect(display.effectiveDrawLocationMarkers).toBe(true)
  expect(view.effectiveDrawCurves).toBe(true)
  expect(view.effectiveDrawLocationMarkers).toBe(true)
})

// The tier the `maybeBoolean` sentinel exists for: a track authored `false`
// keeps straight chords under a session that promoted curves, which a plain
// boolean slot could not express — its `false` default would double as the
// inherit signal. Both directions, because only the second one separates "the
// track wins" from "the cascade is gone": `promotedBase` is `false`, so a
// dropped cascade agrees with the first.
test("a track's own configured value beats the session-wide default", () => {
  const { session, view, display } = openPair()
  session.setDisplayTypeDefault('LinearSyntenyDisplay', 'drawCurves', true)
  setConf(display, 'drawCurves', false)
  expect(display.effectiveDrawCurves).toBe(false)
  expect(view.effectiveDrawCurves).toBe(false)

  session.setDisplayTypeDefault('LinearSyntenyDisplay', 'drawCurves', false)
  setConf(display, 'drawCurves', true)
  expect(display.effectiveDrawCurves).toBe(true)
  expect(view.effectiveDrawCurves).toBe(true)
})

test("the view's own property overrides every level of that view", () => {
  const { session, view, display } = openPair()
  session.setDisplayTypeDefault('LinearSyntenyDisplay', 'drawCurves', true)
  setConf(display, 'drawCurves', true)
  view.setDrawCurves(false)
  expect(display.effectiveDrawCurves).toBe(false)
  expect(view.effectiveDrawCurves).toBe(false)

  view.setDrawCurves(true)
  setConf(display, 'drawCurves', false)
  expect(display.effectiveDrawCurves).toBe(true)
  expect(view.effectiveDrawCurves).toBe(true)
})

// One base ribbon and one location-marker tick over the same feature. The
// toggle is a color decision rather than a fetch one — the geometry carries the
// tick either way — so what a promoted default has to move is the alpha the
// marker instance is painted, and `computedColors` is where the display spends
// it.
const GEOMETRY: SyntenyGeometry = {
  bp1: Float32Array.from([0, 40]),
  bp2: Float32Array.from([100, 41]),
  bp3: Float32Array.from([100, 41]),
  bp4: Float32Array.from([0, 40]),
  base0: 0,
  base1: 0,
  kinds: Uint8Array.from([KIND_BASE, KIND_MARKER]),
  instanceFeatureIdx: Uint32Array.from([0, 0]),
  alignmentLengths: Float32Array.from([100, 100]),
  instanceCount: 2,
}

function markerAlpha(display: LinearSyntenyDisplayModel) {
  display.setRpcData(
    packSyntenyFeatureData([{ start: 0, end: 100 }]),
    GEOMETRY,
    'k',
  )
  return abgrAlpha(display.computedColors![1]!)
}

test('the location-marker default reaches the color lane', () => {
  const { session, display } = openPair()
  expect(markerAlpha(display)).toBe(0)
  session.setDisplayTypeDefault(
    'LinearSyntenyDisplay',
    'drawLocationMarkers',
    true,
  )
  expect(markerAlpha(display)).toBeGreaterThan(0)
})
