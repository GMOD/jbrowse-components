import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// Clicking an off-screen mate mark is the only thing in the view that navigates
// a row on the user's behalf, and it was written inside the canvas component's
// pointerup — reachable only by rendering a WebGL band in jsdom, which is to
// say not reachable. It lives on the level now, so what a click does can be
// asked directly.
//
// The hit test is `offscreenMateStrip.test.ts`'s; this is the other half, and
// the half with a consequence: `navToLocString` REPLACES the row's displayed
// regions, so getting the row wrong silently rewrites the wrong axis.

const BP = 16000

function assembly(name: string, refNames: string[]) {
  return {
    name,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}_refseq`,
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: refNames.map(refName => ({
          refName,
          uniqueId: `${name}-${refName}`,
          start: 0,
          end: BP,
          seq: 'a'.repeat(BP),
        })),
      },
    },
  }
}

async function setup() {
  const session = createTestSession() as any
  session.addAssemblyConf(assembly('volvox', ['ctgA']))
  // two contigs, one row: ctgB is the contig the marks point at
  session.addAssemblyConf(assembly('volvox2', ['ctgA', 'ctgB']))
  const view = session.addView('LinearSyntenyView', {
    init: {
      views: [
        { assembly: 'volvox', loc: 'ctgA' },
        { assembly: 'volvox2', loc: 'ctgA' },
      ],
    },
  }) as LinearSyntenyViewModel
  view.setWidth(800)
  await when(() => view.init === undefined)
  return { session, view, level: view.levels[0]! }
}

function refNames(view: LinearSyntenyViewModel, row: number) {
  return view.views[row]!.displayedRegions.map(r => r.refName)
}

test('a mark shows its contig on the row below the level', async () => {
  const { view, level } = await setup()

  level.showOffscreenMateContig('ctgB')
  await when(() => refNames(view, 1).join() === 'ctgB', { timeout: 5000 })

  // and only that row: the query row is where the marks were measured, so
  // rewriting it would move every mark out from under the pointer that clicked
  expect(refNames(view, 0)).toEqual(['ctgA'])
}, 20000)

// A refName that resolves to nothing is ordinary here — the mate names come out
// of an alignment file, and an assembly can be missing the contig one of them
// points at. It has to reach the user as a notification rather than as an
// unhandled rejection in a pointer handler.
test('a contig the row cannot resolve is reported, not thrown', async () => {
  const { session, view, level } = await setup()

  level.showOffscreenMateContig('nope')
  await when(() => session.snackbarMessages.length > 0, { timeout: 5000 })

  expect(session.snackbarMessages[0]!.level).toBe('error')
  expect(refNames(view, 1)).toEqual(['ctgA'])
}, 20000)
