import { createTestSession } from '@jbrowse/web/testUtils'
import { when } from 'mobx'

import type { CircularViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// mirror.paf aligns a1<->b3, a2<->b2 and a3<->b1, so genome B's own contig order
// is exactly the wrong one, and the a3<->b1 row is on the minus strand so one
// chromosome also has to flip. The right answer is therefore readable off the
// fixture rather than off the algorithm.
const PAF = {
  localPath: require.resolve('./test_data/mirror.paf'),
  locationType: 'LocalPathLocation' as const,
}

function assemblyConf(name: string, contigs: string[]) {
  return {
    name,
    sequence: {
      trackId: `${name}_refseq`,
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(refName => ({
          refName,
          uniqueId: `${name}-${refName}`,
          start: 0,
          end: 1000,
          seq: 'a'.repeat(1000),
        })),
      },
    },
  }
}

async function launch(
  autoDiagonalize: boolean,
  beforeLaunch?: (session: any) => void,
  tracks = ['aln'],
) {
  const session = createTestSession() as any
  beforeLaunch?.(session)
  session.addAssemblyConf(assemblyConf('A', ['a1', 'a2', 'a3']))
  session.addAssemblyConf(assemblyConf('B', ['b1', 'b2', 'b3']))
  session.addSessionTrackConf({
    trackId: 'aln',
    name: 'A vs B',
    type: 'SyntenyTrack',
    assemblyNames: ['B', 'A'],
    adapter: {
      type: 'PAFAdapter',
      pafLocation: PAF,
      queryAssembly: 'B',
      targetAssembly: 'A',
    },
  })
  const view = (await session.launchView('CircularView', {
    assembly: ['A', 'B'],
    tracks,
    autoDiagonalize,
  })) as CircularViewModel
  view.setWidth(800)
  await when(() => view.pendingLaunch === undefined, { timeout: 30000 })
  return view
}

function ribbonDisplay(view: CircularViewModel) {
  return view.tracks[0]!.displays[0]! as unknown as {
    ready: boolean
    displayPhase: string
    displayError: unknown
    reload: () => void
  }
}

// Reverse order and each region flipped, which together are the mirror: b3 ends
// up beside genome A's first chromosome (the two arcs meet there once the circle
// wraps) and b1 beside its last, so every ribbon runs between neighboring arcs.
// `reversed` is what the ribbon geometry then reads to keep the pairs untwisted;
// b1 carries the minus-strand row, so it is the one that comes out unflipped.
test('the second genome follows the first, laid out mirrored', async () => {
  const view = await launch(true)
  expect(
    view.displayedRegions.map(r => [
      r.assemblyName,
      r.refName,
      r.reversed ?? false,
    ]),
  ).toEqual([
    ['A', 'a1', false],
    ['A', 'a2', false],
    ['A', 'a3', false],
    ['B', 'b1', false],
    ['B', 'b2', true],
    ['B', 'b3', true],
  ])
  expect(view.pendingAutoDiagonalize).toBe(false)
}, 40000)

// The mirror is applied on the way out and undone on the way in, so a circle
// that is already diagonalized has nothing to move. Without the undo the pass
// would report every chromosome flipped on every run, and flip them.
test('a second pass over the same circle moves nothing', async () => {
  const view = await launch(true)
  const before = JSON.stringify(view.displayedRegions)
  const { runCircularDiagonalize } =
    await import('./util/runCircularDiagonalize.ts')
  const stats = await runCircularDiagonalize(view)
  expect(stats).toEqual({ totalReordered: 0, totalReversed: 0 })
  expect(JSON.stringify(view.displayedRegions)).toBe(before)
}, 40000)

// A ribbon track aligning neither genome on the circle never fetches, so it
// never loads, and the reorder must not wait for it
test('a ribbon track off the circle does not hold up the reorder', async () => {
  const view = await launch(
    true,
    session => {
      session.addAssemblyConf(assemblyConf('C', ['c1']))
      session.addSessionTrackConf({
        trackId: 'offCircle',
        type: 'SyntenyTrack',
        assemblyNames: ['C', 'C'],
        adapter: {
          type: 'PAFAdapter',
          pafLocation: PAF,
          queryAssembly: 'C',
          targetAssembly: 'C',
        },
      })
    },
    ['aln', 'offCircle'],
  )
  expect(view.tracks).toHaveLength(2)
  expect(view.displayedRegions.some(r => r.reversed)).toBe(true)
}, 40000)

// Without the launch key the circle keeps the order it was given, which is the
// hairball: every pair of matching chromosomes sits at antipodal angles.
test('the circle keeps its given order without the key', async () => {
  const view = await launch(false)
  expect(view.displayedRegions.map(r => r.refName)).toEqual([
    'a1',
    'a2',
    'a3',
    'b1',
    'b2',
    'b3',
  ])
  expect(view.displayedRegions.some(r => r.reversed)).toBe(false)
}, 40000)

// A pairwise file indexes every row from both ends and the circle asks for both
// genomes' regions, so the fixture's three alignments arrive as six features.
// Six ribbons is three drawn twice: the translucent fill's alpha doubles and the
// figure costs twice the paths it needs.
test('an alignment reached from both genomes draws one ribbon', async () => {
  const view = await launch(false)
  const display = view.chordSyntenyDisplays[0] as unknown as {
    features?: unknown[]
  }
  await when(() => display.features !== undefined, { timeout: 30000 })
  expect(display.features).toHaveLength(3)
}, 40000)

// The reorder is offered on a two-genome circle carrying ribbons and nowhere
// else: a mirror is only defined for two arcs, and with no synteny track there
// are no alignments to order by.
test('the reorder is not offered without both halves', async () => {
  const view = await launch(false)
  expect(view.canDiagonalize).toBe(true)
  view.setDisplayedRegions(
    view.displayedRegions.filter(r => r.assemblyName === 'A'),
  )
  expect(view.canDiagonalize).toBe(false)
}, 40000)

// The reorder orders from the ribbons' own fetch, and moving regions does not
// refetch them, so a launch that reorders reads the file once
test('a reordering launch reads the alignments once', async () => {
  const calls: string[] = []
  const view = await launch(true, session => {
    const call = session.rpcManager.call.bind(session.rpcManager)
    jest.spyOn(session.rpcManager, 'call').mockImplementation((...args) => {
      calls.push(args[1] as string)
      return call(...args)
    })
  })
  const reads = () => calls.filter(name => name === 'CoreGetFeatures').length
  await when(() => ribbonDisplay(view).ready, { timeout: 30000 })
  expect(view.displayedRegions.some(r => r.reversed)).toBe(true)
  // a refetch would follow the reorder by the fetch's 300ms debounce, and
  // nothing observable says it declined, so wait out several of those
  await expect(when(() => reads() > 1, { timeout: 1500 })).rejects.toThrow(
    'WHEN_TIMEOUT',
  )
  expect(reads()).toBe(1)
}, 40000)
