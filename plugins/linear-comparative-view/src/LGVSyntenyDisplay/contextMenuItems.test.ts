import { SimpleFeature } from '@jbrowse/core/util'

import { createDisplay } from './testEnv.ts'

function labels(display: ReturnType<typeof createDisplay>) {
  return display
    .contextMenuItems()
    .map((i: unknown) => (i as { label?: string }).label)
}

function makeFeature(mateAssembly: string) {
  return new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    mate: { refName: 'ctgB', start: 0, end: 100, assemblyName: mateAssembly },
  })
}

// The whole point of building these from the id: the feature behind a
// right-clicked PAF block arrives an RPC later (a whole-block re-read, before
// the lookup was narrowed), and gating the items on it opened a menu with
// nothing in it.
test('the block items are there before the feature fetch lands', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2], featureId: 'f1' })
  expect(display.contextMenuFeature).toBeUndefined()
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
  ])
})

// The exception, and why it goes last: whether a synteny view can open is a
// per-feature question (the mate's assembly), so it can only appear once the
// feature lands — appending, rather than inserting above items the cursor is
// already over.
test('a launchable mate appends the synteny item when the feature lands', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2], featureId: 'f1' })
  display.setContextMenuFeature(makeFeature('volvox_random'))
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
    'Launch synteny view for this position',
  ])
})

// A one-vs-all mate can be a PanSN sample that is no declared assembly of the
// track; offering a view that fails to open would be worse than not offering it.
test('a mate outside the track assemblies gets no synteny item', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2], featureId: 'f1' })
  display.setContextMenuFeature(makeFeature('HG002#1'))
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
  ])
})

test('a right-click on no feature offers no feature items', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2] })
  expect(labels(display)).toEqual([])
})
