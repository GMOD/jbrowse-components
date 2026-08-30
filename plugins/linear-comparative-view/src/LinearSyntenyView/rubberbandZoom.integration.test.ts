import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const BP = 100000

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
          end: BP,
          seq: 'a'.repeat(BP),
        },
      ],
    },
  },
})

async function launch() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('a1'))
  session.addAssemblyConf(assembly('a2'))
  const view = session.addView('LinearSyntenyView', {
    init: { views: [{ assembly: 'a1' }, { assembly: 'a2' }] },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.init === undefined)
  return view
}

// The menu closes before it runs the clicked item's callback, and closing
// releases the rubberband offsets, so an item reading them live saw undefined
// and "Zoom to region(s)" did nothing at all
test('zoom to region(s) survives the selection being released on menu close', async () => {
  const view = await launch()
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
