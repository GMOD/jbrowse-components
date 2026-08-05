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

test('the session keeps every member a published plugin reaches for', () => {
  const session = createTestSession()
  const missing = Object.entries(PLUGIN_FACING)
    .filter(([name]) => !(name in session))
    .map(([name, plugin]) => `${name} (${plugin})`)

  expect(missing).toEqual([])
})
