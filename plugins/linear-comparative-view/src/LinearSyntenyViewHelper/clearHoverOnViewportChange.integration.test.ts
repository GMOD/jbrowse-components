import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Nothing on the shared canvas travels with a ribbon, so when the ribbons move
// under a stationary cursor no pointer event fires and nothing re-picks. Without
// the level's reaction the tooltip and the darkened ribbon stay pinned to an
// alignment that has slid away — the same failure `installClearHoverOnViewportChange`
// answers on the LGV side and `setupClearHoverOnPlotMove` on the dotplot's.
//
// Driven through the model rather than through a pick: what is under test is
// that a viewport change reaches the hover at all, and the pick engine has its
// own suites.

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

async function openHovered() {
  const session = createTestSession()
  session.addAssemblyConf(assembly('volvox'))
  session.addAssemblyConf(assembly('volvox2'))
  session.addTrackConf({
    type: 'SyntenyTrack',
    trackId: 'vol_synteny',
    name: 'vol synteny',
    assemblyNames: ['volvox', 'volvox2'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: { uri: 'volvox.paf', locationType: 'UriLocation' },
      queryAssembly: 'volvox',
      targetAssembly: 'volvox2',
    },
  })
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
      tracks: ['vol_synteny'],
    },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(
    () => view.views.length > 0 && view.views.every(v => v.initialized),
  )
  await when(() => view.levels.length > 0)
  const level = view.levels[0]!
  await when(() => level.linearSyntenyDisplays.length > 0, { timeout: 5000 })
  const display = level.linearSyntenyDisplays[0]!

  level.setHoveredFeature({ key: display.displayKey, instanceIndex: 3 })
  expect(display.hoveredInstanceIdx).toBe(3)
  return { view, level, display }
}

test('zooming a row drops the hover it moved out from under', async () => {
  const { view, display } = await openHovered()

  view.views[0]!.zoomTo(view.views[0]!.bpPerPx / 2)

  expect(display.hoveredInstanceIdx).toBe(-1)
})

test('panning a row drops the hover', async () => {
  const { view, display } = await openHovered()

  view.views[1]!.horizontalScroll(120)

  expect(display.hoveredInstanceIdx).toBe(-1)
})

test('resizing the band is not a viewport change', async () => {
  // Pins what `viewportKey` is about. A ribbon spans the whole band height
  // whatever that height is, so the alignment under the cursor is unchanged and
  // dropping the hover on every pixel of a resize-handle drag would be noise.
  const { level, display } = await openHovered()

  level.setHeight(level.height + 40)

  expect(display.hoveredInstanceIdx).toBe(3)
})
