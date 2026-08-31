import { getConf, setConf } from '@jbrowse/core/configuration'
import { abgrAlpha } from '@jbrowse/core/util/colorBits'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

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
// `renderParams.drawCurves` is asserted end-to-end below: its `boolean` type
// refuses the raw `view.drawCurves` the getter replaced, but a literal `false`
// satisfies tsc — and with `promotedBase` also `false`, every suite that stops
// at the getters. `computeSyntenyColors` takes `drawLocationMarkers` optionally
// and has no type guard either, so the marker lane is asserted through the
// display below rather than through the color function, which is already
// covered on its own inputs.
//
// The settings checkbox is pinned here too: `setDrawCurves` /
// `setDrawLocationMarkers` write the SLOT, on every level of the view — there
// is no view-level property over the cascade — so the checkbox is the same
// write as any promotable row's and everything that unsets a slot (the badge,
// the config editor's reset) puts a view back on the session default.

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
    display: view.allSyntenyDisplays[0]!,
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

// The checkbox means every level. A three-row view has two synteny displays,
// and `setDrawCurves` has to write the slot on BOTH — a fan-out that stopped
// at `allSyntenyDisplays[0]`, or wrote some view-local state instead of the
// slot, leaves the second band drawing the old shape.
function openTriple() {
  const session = createTestSession()
  for (const name of ['volvox', 'volvox2', 'volvox3']) {
    session.addAssemblyConf(assembly(name))
  }
  for (const [trackId, q, t] of [
    ['pairA', 'volvox', 'volvox2'],
    ['pairB', 'volvox2', 'volvox3'],
  ] as const) {
    session.addTrackConf({
      type: 'SyntenyTrack',
      trackId,
      name: trackId,
      assemblyNames: [q, t],
      adapter: {
        type: 'PAFAdapter',
        pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
        queryAssembly: q,
        targetAssembly: t,
      },
    })
  }
  const view = session.addView('LinearSyntenyView', {
    views: [
      { type: 'LinearGenomeView' },
      { type: 'LinearGenomeView' },
      { type: 'LinearGenomeView' },
    ],
  }) as LinearSyntenyViewModel
  view.showTrack('pairA', 0)
  view.showTrack('pairB', 1)
  return {
    session,
    view,
    displays: view.allSyntenyDisplays,
  }
}

test('the settings checkbox writes the slot on every level', () => {
  const { view, displays } = openTriple()
  expect(displays).toHaveLength(2)
  view.setDrawCurves(true)
  view.setDrawLocationMarkers(true)
  for (const d of displays) {
    expect(getConf(d, 'drawCurves')).toBe(true)
    expect(d.effectiveDrawCurves).toBe(true)
    expect(getConf(d, 'drawLocationMarkers')).toBe(true)
    expect(d.effectiveDrawLocationMarkers).toBe(true)
  }
  expect(view.effectiveDrawCurves).toBe(true)
  expect(view.effectiveDrawLocationMarkers).toBe(true)

  view.setDrawCurves(false)
  for (const d of displays) {
    expect(d.effectiveDrawCurves).toBe(false)
  }
})

// THE DEFECT THIS FILE EXISTS TO KEEP FIXED, and the two halves of "nothing
// gets stuck". Unticking under a promoted "curves on" must straighten — the
// write is a real track customization, same as any promotable checkbox, so a
// setter that unsets the slot instead leaves the ribbons curved. And the way
// home is the same one every promotable slot has: unsetting the slot (the
// badge's reset, the config editor's reset-to-default) rejoins the cascade.
// The removed view-level property had neither half: its first write detached
// the view from the cascade for good.
test('unticking under a promoted default straightens, and unsetting rejoins', () => {
  const { session, view, display } = openPair()
  session.setDisplayTypeDefault('LinearSyntenyDisplay', 'drawCurves', true)
  view.setDrawCurves(false)
  expect(getConf(display, 'drawCurves')).toBe(false)
  expect(display.effectiveDrawCurves).toBe(false)
  expect(view.effectiveDrawCurves).toBe(false)

  setConf(display, 'drawCurves', undefined)
  expect(display.effectiveDrawCurves).toBe(true)
  expect(view.effectiveDrawCurves).toBe(true)
})

// The marker twin, which had zero jest callers on its setter: a
// `setDrawLocationMarkers` that wrote nothing — or an
// `effectiveDrawLocationMarkers` hard-wired to its base — stayed green
// everywhere else, since `promotedBase` is `false` too.
test('setDrawLocationMarkers customizes the shown tracks', () => {
  const { view, display } = openPair()
  view.setDrawLocationMarkers(true)
  expect(getConf(display, 'drawLocationMarkers')).toBe(true)
  expect(display.effectiveDrawLocationMarkers).toBe(true)
  expect(view.effectiveDrawLocationMarkers).toBe(true)

  view.setDrawLocationMarkers(false)
  expect(display.effectiveDrawLocationMarkers).toBe(false)
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

// `renderParams` gates on two initialized rows with regions, so this setup
// pays for what `openPair` deliberately avoids — an `init` that settles and a
// fetch left to fail quietly — to reach the one field the backends draw from.
// The synteny track rides the init too, so an `initExtras` key exercises the
// launch path a spec or URL takes.
async function openInitializedPair(initExtras: Record<string, unknown> = {}) {
  const session = createTestSession() as any
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addSessionTrackConf({
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
    views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
    tracks: ['pair'],
    ...initExtras,
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined)
  const level = view.levels[0]!
  await when(() => level.linearSyntenyDisplays.length > 0)
  return {
    session,
    view,
    display: level.linearSyntenyDisplays[0]!,
  }
}

// The authored spellings — an img spec's `drawCurves: true`, a demo config's
// `drawCurves: false`, a share URL — are init keys, and with no view property
// behind them they are launch COMMANDS now: the launcher writes the slot on
// the tracks it opened. A key dropped from the command list would be reported
// as unknown and silently change nothing.
test('the init drawCurves key customizes the tracks the init opens', async () => {
  const { display } = await openInitializedPair({
    drawCurves: true,
    drawLocationMarkers: true,
  })
  expect(getConf(display, 'drawCurves')).toBe(true)
  expect(display.effectiveDrawCurves).toBe(true)
  expect(getConf(display, 'drawLocationMarkers')).toBe(true)
}, 20000)

// The end-to-end hole the header names: `renderParams.drawCurves` typed
// `boolean` accepts a literal `false`, which agrees with `promotedBase` in
// every other suite. Asserting the promoted TRUE through `renderParams` is
// what a dropped `effectiveDrawCurves` read cannot fake.
test('renderParams carries the promoted drawCurves to the backend', async () => {
  const { session, display } = await openInitializedPair()
  await when(() => display.renderParams !== undefined)
  expect(display.renderParams!.drawCurves).toBe(false)
  session.setDisplayTypeDefault('LinearSyntenyDisplay', 'drawCurves', true)
  expect(display.renderParams!.drawCurves).toBe(true)
}, 20000)
