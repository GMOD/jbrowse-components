import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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
  const view = (await session.launchView('LinearSyntenyView', {
    views: [{ assembly: 'a1' }, { assembly: 'a2' }],
  })) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined)
  return view
}

function clickable(items: MenuItem[], label: string) {
  const found = items.find(i => 'label' in i && i.label === label)
  if (!found || !('onClick' in found)) {
    throw new Error(`no clickable "${label}" in ${JSON.stringify(items)}`)
  }
  return found
}

function subMenu(items: MenuItem[], label: string) {
  const found = items.find(i => 'label' in i && i.label === label)
  if (!found || !('subMenu' in found)) {
    throw new Error(`no submenu "${label}"`)
  }
  return resolveSubMenu(found)
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
  clickable(items, 'Zoom to region(s)').onClick()

  for (const [i, v] of view.views.entries()) {
    expect(v.bpPerPx).toBeLessThan(before[i]!)
  }
})

// A drag commits offsets on every row, so each row's own rubberband menu
// describes a real selection; the stacked menu offers it under the row's name.
test('each row offers its own rubberband menu', async () => {
  const view = await launch()
  for (const v of view.views) {
    v.setOffsets(v.pxToBp(100), v.pxToBp(300))
  }
  const items = view.rubberBandMenuItems()
  const rows = ['a1', 'a2'].map(name => subMenu(items, name))

  for (const row of rows) {
    // the four unconditional rows. "Linear genome view" is a top-level view's
    // only, and the plugin-contributed Launch group needs a synteny track to
    // open one from
    expect(row.map(i => ('label' in i ? i.label : i.type))).toEqual([
      'Zoom to region',
      'Get sequence',
      'Copy range',
      'Highlight region',
    ])
  }

  // and they act on the row they were named for, holding the offsets past the
  // menu's close like the zoom row does
  const before = view.views[1]!.bpPerPx
  for (const v of view.views) {
    v.setOffsets(undefined, undefined)
  }
  clickable(rows[1]!, 'Zoom to region').onClick()
  expect(view.views[1]!.bpPerPx).toBeLessThan(before)
  expect(view.views[0]!.bpPerPx).not.toBeLessThan(before)
})
