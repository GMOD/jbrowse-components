import { isSessionWithAddTracks } from '@jbrowse/core/util'
import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// The session members published plugins call, pinned the way
// `ReExports/abi.test.ts` pins the module exports they import.
//
// That test guards the wrong half for this failure. A plugin links `@jbrowse/*`
// module exports at import time, so dropping one turns into `undefined` at
// module scope and error-pages the app — loud, and abi.test.ts catches it. But a
// plugin reaches the SESSION at runtime, through a member lookup on an object
// this repo composes from mixins, and nothing checked that surface at all.
//
// The failure mode is quieter than the ABI one, which is why it needs its own
// guard. `jbrowse-plugin-protein3d` asks for its side-by-side layout behind
//
//     'setPendingMove' in session && session.setPendingMove({...})
//
// so when that action was folded away with the state it wrote to, nothing threw:
// the guard went false, the plugin stopped asking for a split, and its two views
// silently started stacking. Eight commits later a website figure was the only
// thing that had noticed. A capability-detecting caller cannot report a
// capability that vanished — it just stops using it — so the host has to be the
// one that notices.
//
// The list is evidence, not a wish: it is the intersection of the members this
// repo's session mixins define with the identifiers that appear in the published
// bundles of the two plugins the repo itself points at (protein3d in
// `test_data/protein3d_config.json`, graphgenomeviewer in the screenshot
// generator's TRUSTED_PLUGIN_URLS). Extend it when another plugin is checked;
// say in the commit which bundle you read.
//
// Recomputing it is a grep of each bundle for `.member` / `"member"` against the
// session's own member names — minification renames the variable but not the
// property — followed by throwing out the hits that land on some other object.
// That last step is the whole job and it needs eyes: `assemblyNames` reads off a
// track, `setHovered` off the plugin's own model, `palette` off the MUI theme.
//
// Removals fail here, additions don't — same doctrine as the ABI baseline. To
// drop one deliberately, delete it in the same commit as the change and say
// which published plugins you checked.
const PLUGIN_FACING = {
  // a deprecated alias since the destination split; the call test below is what
  // actually holds it, because a name that survives while its meaning moves is
  // the failure this file exists for
  addTrackConf: 'protein3d',
  // optional-chained at the call site (`session.addTemporaryAssembly?.({...})`),
  // so losing it degrades as silently as setPendingMove did
  addTemporaryAssembly: 'protein3d',
  addView: 'protein3d, graphgenomeviewer',
  addWidget: 'graphgenomeviewer',
  assemblyManager: 'protein3d, graphgenomeviewer',
  getTracksById: 'protein3d',
  notify: 'protein3d, graphgenomeviewer',
  queueDialog: 'protein3d',
  rpcManager: 'protein3d',
  // its `sideBySide` launch option, behind an `in session` guard
  setPendingMove: 'protein3d',
  setUseWorkspaces: 'protein3d',
  showWidget: 'graphgenomeviewer',
  tracks: 'protein3d, graphgenomeviewer',
  views: 'graphgenomeviewer',
}

test('the session keeps every member a published plugin reaches for', async () => {
  const session = createTestSession()
  const missing = Object.entries(PLUGIN_FACING)
    .filter(([name]) => !(name in session))
    .map(([name, plugin]) => `${name} (${plugin})`)

  expect(missing).toEqual([])
})

// **Presence is only half of it, and the other half broke next.** The list above
// asks whether the member is there; a plugin asks whether the CALL works, and a
// member can keep its name while gaining a required argument. `setPendingMove`
// did, in the workspace-layout rewrite, and calling it the way protein3d spells
// it threw `Cannot read properties of undefined (reading 'filter')` out of a
// launch the plugin does not wrap — so the view never got its split, the failure
// went to a snackbar, and `protein/connected` stopped capturing.
//
// So this one performs the gesture rather than describing it, spelled exactly as
// the published bundle spells it (jbrowse-plugin-protein3d 0.8.0, minified:
// `Ec(e)&&(e.setPendingMove({type:"splitRight",viewId:t}),e.setUseWorkspaces(!0))`).
// Casts because that is the plugin's view of the session too — it has no types
// for any of this and reaches these members off `unknown`.
test("protein3d's side-by-side launch still splits, called as the plugin calls it", () => {
  const session = createTestSession() as any
  const genome = session.addView('LinearGenomeView', {
    type: 'LinearGenomeView',
  })
  const protein = session.addView('LinearGenomeView', {
    type: 'LinearGenomeView',
  })

  session.setPendingMove({ type: 'splitRight', viewId: protein.id })
  session.setUseWorkspaces(true)

  // Two cells, not one: the point of the gesture. And the genome view is still
  // in the layout — the argument the plugin cannot pass is the list homing uses
  // to decide what stays, so defaulting it to nothing would drop this one and
  // still leave a workspace with a protein view in it looking plausible.
  expect(session.panels.length).toBe(2)
  expect(session.tabContainingView(genome.id)).toBeDefined()
  expect(session.tabContainingView(protein.id)).toBeDefined()
  expect(session.tabContainingView(genome.id).panel.id).not.toBe(
    session.tabContainingView(protein.id).panel.id,
  )
})

// **A member can also keep its name while its DESTINATION moves**, which the
// presence list cannot see either. `addTrackConf` used to publish an admin's
// track into the config.json every visitor is served; it now means the session,
// because that is what its callers wanted and the two meanings behind one name
// were shipping dead per-click entries into everyone's config. protein3d reaches
// it through the guard it also links by name, so both halves are performed here
// as the published bundle spells them (jbrowse-plugin-protein3d 0.8.0, minified:
// `(0,ll.isSessionWithAddTracks)(e)?e:void 0` off
// `JBrowseExports['@jbrowse/core/util']`, then `addTrackConf` on the result).
//
// An admin session on purpose: a non-admin lands in the session either way, so
// only an admin can tell the two destinations apart.
test("protein3d's structure track still lands, and lands in the session", () => {
  const session = createTestSession({ adminMode: true }) as any
  expect(isSessionWithAddTracks(session)).toBe(true)

  const added = session.addTrackConf({
    trackId: 'protein3d-structure',
    type: 'FeatureTrack',
    assemblyNames: ['volvox'],
    adapter: { type: 'FromConfigAdapter', features: [] },
  })

  expect(added).toBeDefined()
  expect(session.sessionTracks.map((t: any) => t.trackId)).toEqual([
    'protein3d-structure',
  ])
  expect(session.jbrowse.tracks).toHaveLength(0)
})

// The same doctrine one level out, for the surface an automation SCRIPT reads
// rather than a plugin. `components/JBrowse.tsx` assigns the live session to
// `window.JBrowseSession`, and the walk below —
// `views[].initialized`, `views[].assemblyNames`,
// `views[].tracks[].configuration.trackId` — is what answers "did the thing I
// asked for actually open". The positive readiness gate in `@jbrowse/capture`
// is exactly this walk, and the published docs
// (`website/docs/agents_capture.md`) and the `jbrowse-capture` skill both print
// it for readers to paste.
//
// It fails even quieter than the plugin surface. A script has no import to break
// and no capability check to go false: `views[].tracks[].configuration.trackId`
// simply reads `undefined`, the gate never passes, and the symptom is a timeout
// blamed on a slow network. Renaming any of these is a breaking change for every
// agent script in the wild, so it should cost a deliberate edit here.
const AUTOMATION_FACING = [
  // window.JBrowseSession.views
  'views',
] as const

function hasKey<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value
}

// `views[].tracks[].configuration.trackId`, read the way an outside script reads
// it: property by property, off `unknown`, with no help from the model's types.
function openTrackIds(view: unknown): string[] {
  const tracks = hasKey(view, 'tracks') ? view.tracks : undefined
  return (Array.isArray(tracks) ? (tracks as unknown[]) : []).map(track => {
    const conf = hasKey(track, 'configuration')
      ? track.configuration
      : undefined
    const id = hasKey(conf, 'trackId') ? conf.trackId : undefined
    return typeof id === 'string' ? id : '(unreadable)'
  })
}

test('the automation-facing session walk still resolves', async () => {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox-ref',
            adapter: { type: 'TwoBitAdapter', uri: 'volvox.2bit' },
          },
        },
      ],
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'volvox-genes',
          assemblyNames: ['volvox'],
          adapter: { type: 'Gff3TabixAdapter', uri: 'volvox.gff.gz' },
        },
      ],
    },
  })
  for (const name of AUTOMATION_FACING) {
    expect(name in session).toBe(true)
  }
  // The rest of the walk is per-view and per-track, so assert the shape rather
  // than the names alone: a view reports whether it finished initializing and
  // which assembly it is on, and an OPEN track (a track model on the view, not a
  // config in the catalog) is identified by the trackId of the config behind it.
  const view = session.addView('LinearGenomeView', { type: 'LinearGenomeView' })
  expect('initialized' in view).toBe(true)
  expect('assemblyNames' in view).toBe(true)

  await view.launchTrack('volvox-genes')
  // Walked blindly, exactly as a script in a `page.evaluate` walks it, rather
  // than through the view's TypeScript types: those describe the model this repo
  // compiles against, and what is being pinned here is what survives a property
  // lookup from outside. A shape change reads as '(unreadable)' and fails on the
  // value, which is the same way the script would experience it.
  expect(openTrackIds(view)).toEqual(['volvox-genes'])

  // The census contract the walk is retiring behind: each view answers for
  // itself (BaseViewModel derives these), AppReadyMarker publishes the
  // reduction as data-app-* attributes, and capture's gate reads those. Pinned
  // on a real session-created view because everything downstream — the marker,
  // jbApi, the published census — assumes a view a session opens carries them.
  expect(view.allViews).toEqual([view])
  expect(
    (view.ownTracks as unknown[]).map(
      t => (t as { configuration: { trackId?: string } }).configuration.trackId,
    ),
  ).toEqual(['volvox-genes'])
  expect(view.allTracks).toEqual(view.ownTracks)
})
