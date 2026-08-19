import { promotableSlotsWithoutPin } from '@jbrowse/core/ui'

import { doBeforeEach, getPluginManager } from './util.tsx'

import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

// **Why this lives in jbrowse-web and not in core.** It is not a jbrowse-web
// concern at all; it is here because this is the only place the whole plugin set
// is assembled. The check needs a *live display model of every registered type*
// — `trackMenuItems()` is an MST view over a display in a view in a session —
// and core has no plugins while a plugin can only see its own displays, so
// neither can ask the question. `pluginFacingSessionApi.test.ts` next door is
// here for exactly the same reason. The reusable half is in core
// (`promotableSlotsWithoutPin`); only the fixture list and the baseline are here.
//
// A promotable slot with no pin is the quietest failure this subsystem has.
// Declaring `promotedBase` is a *schema* fact that travels down
// `baseConfiguration` to every subclass; the pin is a *menu* fact, built by
// whichever `trackMenuItems()` happens to construct a row for that slot. A
// display that inherits the slot and
// curates its own menu therefore has a slot nobody can ever promote — a promoted
// default is keyed by display type, so no other display's pin writes its key
// either — and nothing says so: no throw, no visual difference, and the
// generated config docs go on advertising the setting as having a session-wide
// default.
//
// The state used to be a hand-maintained table in
// agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md, and it drifted twice: it grew a
// row for a slot that had been deleted (LinearManhattanDisplay `lineWidth`, gone
// when GWAS stopped extending the wiggle schema) and lost one that had been
// added (`showSashimiArcs`). This is that table, checked.
//
// Additions to the baseline are the thing to resist. Removals are the point:
// wiring a missing row should make this fail, and the fix is to delete the line.

// What the pin-less list is *expected* to be, per display type. Every entry is a
// deliberate product gap, not a bug to route around — see the reference doc for
// why `promotedBase: undefined` is not an alternative (these slots are read
// through a shared model's `resolveConf` getters, which throw on a
// non-promotable slot).
const KNOWN_UNPINNED: Record<string, string[]> = {
  // Composes the alignments state model but curates its own menu, so it takes
  // only the colour, feature-height and height-mode pins. Everything below is a
  // read-level setting synteny deliberately does not surface.
  LGVSyntenyDisplay: [
    'linkedReads',
    'mismatchAlpha',
    'readConnections',
    'readConnectionsDown',
    'sashimiArcsMode',
    'showSashimiArcs',
    'showSashimiLabels',
    'showSoftClipping',
  ],
  // Inherited but inert, and a pin would be the wrong fix: both are
  // transcript-structure settings (chevrons are emitted between a transcript's
  // exons, `subfeatureLabels` labels transcript children) and a VCF feature has
  // no such subfeatures. They reach this schema only via the shared canvas base.
  // `promotedBase: undefined` is not the other-direction fix either — the base
  // `rpcProps` resolves promotable slots for the worker, so a slot that stops
  // being promotable ships the bare sentinel. Reference doc has the argument.
  LinearVariantDisplay: ['displayDirectionalChevrons', 'subfeatureLabels'],
}

// One open display per registered type that declares a promotable slot, and the
// states its menu has to be driven into to offer every row it has.
//
// `states` exists because a row can be gated on the display's own state: the
// wiggle size rows are exclusive (point size in a scatter rendering, line width
// in a line one), so no single menu build shows both. The test unions the pins
// found across every state, which is the honest reading of "can a user reach
// this pin at all".
interface Fixture {
  displayType: string
  trackId: string
  states?: ((display: any) => void)[]
  // Display-level config the fixture opens with, where a row is gated on a
  // *configured* state rather than on a state an action can enter.
  displaySnapshot?: Record<string, unknown>
}

const FIXTURES: Fixture[] = [
  { displayType: 'LinearAlignmentsDisplay', trackId: 'volvox_cram_alignments' },
  { displayType: 'LinearBasicDisplay', trackId: 'gff3tabix_genes' },
  { displayType: 'LinearVariantDisplay', trackId: 'volvox_test_vcf' },
  { displayType: 'LinearPairedArcDisplay', trackId: 'volvox_sv_test' },
  { displayType: 'LGVSyntenyDisplay', trackId: 'volvox_fake_synteny' },
  { displayType: 'LinearManhattanDisplay', trackId: 'volvox_gwas' },
  {
    displayType: 'LinearWiggleDisplay',
    trackId: 'volvox_microarray',
    states: wiggleRenderingStates(),
  },
  {
    // the multi-row family spells its renderings `multi*`, and the size rows
    // match on the `scatter` / `line` substring, so these are the same two gates
    displayType: 'MultiLinearWiggleDisplay',
    trackId: 'volvox_microarray_multi',
    states: [
      ...wiggleRenderingStates('multirowscatter', 'multirowline'),
      overlayWithSources,
    ],
  },
  {
    displayType: 'LinearGCContentTrackDisplay',
    trackId: 'volvox_gc',
    states: wiggleRenderingStates(),
  },
  {
    displayType: 'LinearGCContentDisplay',
    trackId: 'volvox_refseq',
    states: wiggleRenderingStates(),
  },
  {
    // The legend row is gated on the display having a key to show, and a
    // configured `legend` is one of the two things that gives it one —
    // `colorLegend` reads the slot before it derives anything from data. That
    // is the honest way in here, the way `overlayWithSources` is for
    // multi-wiggle: the pin is reachable in any session with a legend, and
    // would otherwise read as missing because this test never fetches.
    displayType: 'LinearMultiRowFeatureDisplay',
    trackId: 'gff3tabix_genes',
    displaySnapshot: { legend: [{ label: 'a', color: 'red' }] },
  },
  {
    displayType: 'LinearMultiSampleVariantDisplay',
    trackId: 'volvox multi-sample sv',
  },
  {
    displayType: 'LinearMultiSampleVariantMatrixDisplay',
    trackId: 'volvox multi-sample sv',
  },
  { displayType: 'LDDisplay', trackId: 'volvox multi-sample sv' },
]

// The wiggle family gates its two size rows on the rendering type, and the two
// are mutually exclusive, so both have to be visited.
function wiggleRenderingStates(scatter = 'scatter', line = 'line') {
  return [scatter, line].map(rendering => (d: any) => {
    d.setRenderingType(rendering)
  })
}

// The multi-wiggle "Show legend" row is gated on `overlayLegendApplies`, which
// needs an overlay rendering AND more than one source — and sources arrive with
// the data, which this test never fetches. `setRpcData` is the action a landed
// fetch calls, and the only field it reads is `sources`, so seeding it directly
// is the honest way to reach the state rather than a shortcut around it. Without
// this the display's promotable `showLegend` would look pin-less here while
// being pinned in every real session that has data.
function overlayWithSources(d: any) {
  d.setRenderingType('multixyplot')
  d.setRpcData(0, { sources: [{ name: 'a' }, { name: 'b' }] })
}

interface TestView {
  showTrack: (
    trackId: string,
    initialSnapshot?: Record<string, unknown>,
    displayInitialSnapshot?: Record<string, unknown>,
  ) => unknown
  tracks: {
    displays: (ResolvableDisplay & { trackMenuItems: () => MenuItem[] })[]
  }[]
}

beforeEach(() => {
  // a promoted default persists to localStorage, and a leftover one changes
  // which radio is checked — not which rows exist, but keep the runs isolated
  localStorage.clear()
  doBeforeEach()
})

// Open `trackId` showing `displayType`, and return the display. Passing the
// display type is what reaches a track's non-default displays — the SV arcs on a
// VariantTrack, GC content on a ReferenceSequenceTrack.
function openDisplay({ displayType, trackId, displaySnapshot }: Fixture) {
  const { rootModel } = getPluginManager()
  const view = rootModel.session!.views[0] as unknown as TestView
  view.showTrack(trackId, {}, { type: displayType, ...displaySnapshot })
  const display = view.tracks
    .flatMap(t => t.displays)
    .find(d => d.type === displayType)
  if (!display) {
    throw new Error(
      `${displayType} did not open on "${trackId}" — the fixture is stale`,
    )
  }
  return display
}

// Every menu row the display can offer, across the states that reveal them.
// Concatenated rather than merged: `pinnedSlots` walks a flat list of rows and
// their submenus, so the union of two builds is just both lists.
function allMenuItems(fixture: Fixture) {
  const display = openDisplay(fixture)
  const states = fixture.states ?? [() => {}]
  return {
    display,
    menuItems: states.flatMap(enter => {
      enter(display)
      return display.trackMenuItems()
    }),
  }
}

test.each(FIXTURES.map(f => [f.displayType, f] as const))(
  '%s pins every promotable slot its menu should',
  (displayType, fixture) => {
    const { display, menuItems } = allMenuItems(fixture)
    expect(promotableSlotsWithoutPin(display, menuItems)).toEqual(
      KNOWN_UNPINNED[displayType] ?? [],
    )
  },
)

// The baseline is only as good as its reach: an entry for a display type no
// fixture opens would sit here unchecked forever, which is how the prose table
// kept a row for a slot that no longer existed.
test('every baseline entry names a display type this test opens', () => {
  const covered = new Set(FIXTURES.map(f => f.displayType))
  expect(Object.keys(KNOWN_UNPINNED).filter(t => !covered.has(t))).toEqual([])
})
