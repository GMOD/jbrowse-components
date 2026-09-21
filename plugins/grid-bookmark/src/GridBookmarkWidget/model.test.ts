import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { GridBookmarkModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
  const view = {
    type: 'LinearGenomeView',
    bpPerPx: 1,
    offsetPx: 0,
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ],
  }
  const session = createTestSession({
    sessionSnapshot: { views: [view, view] },
  }) as any
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  return { session, widget }
}

// a real assembly, so refName resolution and alias lookup are the product's
// rather than the fixture's. Only ctgA is displayed: ctgB is the highlight the
// keyboard shortcut has to reach without a region list already holding it
async function setupWithAssembly() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          bpPerPx: 1,
          offsetPx: 0,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 16000 },
          ],
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    aliases: ['vvx'],
    sequence: {
      trackId: 'volvox_refseq',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: ['ctgA', 'ctgB'].map(refName => ({
          refName,
          uniqueId: refName,
          start: 0,
          end: 16000,
          seq: 'a'.repeat(16000),
        })),
      },
    },
  })
  await session.assemblyManager.waitForAssembly('volvox')
  return { session, view: session.views[0] }
}

test('the list holds the highlights on an assembly some view shows', () => {
  const { session, widget } = setup()
  expect([...widget.assembliesInViews]).toEqual(['volvox'])
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  session.addHighlight({
    assemblyName: 'other-asm',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  expect(widget.rows.map(r => r.highlight.assemblyName)).toEqual(['volvox'])
})

test('a highlight made in one view is drawn in every view of its assembly', () => {
  const { session } = setup()
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  expect(session.views.map((v: any) => v.highlights.length)).toEqual([1, 1])
})

test('recoloring the selection keeps it selected', () => {
  const { session, widget } = setup()
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  widget.setSelectedKeys(new Set(widget.rows.map(r => r.key)))
  widget.recolorSelectedHighlights('red')
  expect(widget.selectedHighlights.map(h => h.color)).toEqual(['red'])

  widget.removeSelectedHighlights()
  expect(session.highlights).toEqual([])
})

test('a selection outlives a removal elsewhere without moving to a neighbour', () => {
  const { session, widget } = setup()
  for (const start of [0, 200, 400]) {
    session.addHighlight({
      assemblyName: 'volvox',
      refName: 'ctgA',
      start,
      end: start + 100,
    })
  }
  widget.setSelectedKeys(new Set([widget.rows[2]!.key]))
  session.removeHighlight(session.highlights[0])
  expect(widget.selectedHighlights).toEqual([])
})

// ctrl/cmd+shift+M ran through navTo, which throws for a refName the view is
// not already displaying -- inside a keydown listener, so the shortcut did
// nothing at all
test('the newest-highlight shortcut reaches a region the view is not displaying', async () => {
  const { session, view } = await setupWithAssembly()
  session.addHighlight({
    assemblyName: 'volvox',
    refName: 'ctgB',
    start: 100,
    end: 200,
  })

  view.navigateNewestHighlight()
  await when(() => view.displayedRegions[0]?.refName === 'ctgB')
  expect(view.coarseVisibleLocStrings).toContain('ctgB')
})

test('a highlight named by an alias of the view assembly is listed and drawn', async () => {
  const { session, view } = await setupWithAssembly()
  const widget = session.addWidget(
    'GridBookmarkWidget',
    'GridBookmark',
  ) as GridBookmarkModel
  session.addHighlight({
    assemblyName: 'vvx',
    refName: 'ctgA',
    start: 0,
    end: 100,
  })
  expect(widget.rows).toHaveLength(1)
  expect(view.highlights).toHaveLength(1)
})
