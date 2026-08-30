import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: ['ctgA', 'ctgB'].map(refName => ({
        refName,
        uniqueId: `volvox-${refName}`,
        start: 0,
        end: 100_000,
        seq: 'a'.repeat(100_000),
      })),
    },
  },
}

async function setup() {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  const view = session.addView('BreakpointSplitView', {
    init: [
      { assembly: 'volvox', loc: 'ctgA:1-50000' },
      { assembly: 'volvox', loc: 'ctgB:1-50000' },
    ],
  }) as unknown as BreakpointViewModel
  view.setWidth(800)
  await when(
    () =>
      view.views.length > 0 &&
      view.views.every(v => v.displayedRegions.length > 0),
  )
  return view
}

// The menu closes before it runs the clicked item's callback, and closing
// releases the rubberband offsets, so an item reading them live saw undefined
// and "Zoom to region(s)" did nothing at all
test('zoom to region(s) survives the selection being released on menu close', async () => {
  const view = await setup()
  const before = view.views.map(v => v.bpPerPx)

  for (const v of view.views) {
    v.setOffsets(v.pxToBp(100), v.pxToBp(300))
  }
  const items = view.rubberBandMenuItems()
  for (const v of view.views) {
    v.setOffsets(undefined, undefined)
  }
  items[0]!.onClick()

  for (const [i, v] of view.views.entries()) {
    expect(v.bpPerPx).toBeLessThan(before[i]!)
  }
})
