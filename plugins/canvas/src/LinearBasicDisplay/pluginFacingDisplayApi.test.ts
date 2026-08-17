import { makeFlatbushItem } from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment, rightClick } from './testEnv.ts'

// The LinearBasicDisplay members published plugins read off the display, pinned
// the way `pluginFacingSessionApi.test.ts` pins the session's.
//
// That test guards the session; this is the same failure one object over, and it
// has already happened here. `jbrowse-plugin-msaview` builds its "Launch MSA
// view" right-click item behind
//
//     contextMenuInfo && fetchFullFeature && self.isGeneLike
//
// and 684142b329 inlined `isGeneLike` into this display's own
// `contextMenuItems`, since it had one caller left. Nothing failed: the plugin
// still found `contextMenuInfo` and `fetchFullFeature`, the third read went
// `undefined`, and the item left the menu on every gene track while the menu
// itself still opened with the host's items in it. A capability-detecting caller
// cannot report a capability that vanished, so the host has to notice.
//
// The list is evidence, not a wish: these are the identifiers msaview's
// published bundle reads off the display model. Extend it when another plugin is
// checked, and say in the commit which bundle you read.
//
// Removals fail here, additions don't. To drop one deliberately, delete it in
// the same commit as the change and say which published plugins you checked.
const PLUGIN_FACING = {
  contextMenuInfo: 'msaview, protein3d',
  fetchFullFeature: 'msaview, protein3d',
  isGeneLike: 'msaview',
}

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

test('the display keeps every member a published plugin reaches for', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()

  const missing = Object.entries(PLUGIN_FACING)
    .filter(([name]) => !(name in display))
    .map(([name, plugin]) => `${name} (${plugin})`)

  expect(missing).toEqual([])
})

// A plugin extends the display by capturing the base method and calling it
// DETACHED:
//
//     const superContextMenuItems = self.contextMenuItems
//     ...
//     return [...superContextMenuItems(), ourItem]
//
// so `this` inside it is undefined, where every test that calls
// `display.contextMenuItems()` supplies the instance and never notices. An
// earlier pass at restoring `isGeneLike` read it as `this.isGeneLike` from
// inside `contextMenuItems`; the unit tests stayed green and the real app threw
// `Cannot read properties of undefined (reading 'isGeneLike')` on right-click,
// error-boundarying the track.
test('contextMenuItems survives being called detached, the way a plugin wraps it', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  const superContextMenuItems = display.contextMenuItems

  expect(() => superContextMenuItems()).not.toThrow()
  rightClick(display, gene)
  expect(() => superContextMenuItems()).not.toThrow()
  expect(
    superContextMenuItems().map(i => ('label' in i ? i.label : undefined)),
  ).toContain('Collapse introns')
})

// Presence is only half of it: `isGeneLike` is a getter over the clicked item,
// so a version that is always undefined would pass the list above and still cost
// the plugin its menu item. This performs the read the way msaview performs it,
// on a gene and on something that is not one.
test('isGeneLike answers for the right-clicked feature', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()

  expect(display.isGeneLike).toBe(false)

  rightClick(display, gene)
  expect(display.isGeneLike).toBe(true)

  rightClick(
    display,
    makeFlatbushItem({
      featureId: 'match1',
      type: 'match',
      name: 'match1',
      startBp: 1050,
      endBp: 9000,
    }),
  )
  expect(display.isGeneLike).toBe(false)
})
