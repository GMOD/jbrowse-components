import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import { followSpreadSpans } from './followSpreadSpans.ts'

import type { LinearSyntenyDisplayModel } from '../LinearSyntenyDisplay/model.ts'
import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

function display(blocks: (FeatureBlock & { mateStart: number })[]) {
  return {
    featureData: packSyntenyFeatureData(
      blocks.map(b => ({
        ...b,
        assembly: 'grape',
        mateAssembly: b.mateAssembly ?? 'peach',
      })),
      { hasCigar: false },
    ),
  } as LinearSyntenyDisplayModel
}

const win = (refName: string, start: number, end: number): FollowWindow => ({
  refName,
  start,
  end,
})

const spread = (
  displays: LinearSyntenyDisplayModel[],
  windows: FollowWindow[],
) => followSpreadSpans({ displays, windows, toMate: true }).spans

// The grape/peach/cacao shape: the mate row's contigs are ORDERED DIFFERENTLY,
// which is why the two outermost windows do not bound the answer and every
// window has to be asked.
const permuted = display([
  {
    refName: 'chr1',
    start: 1_000,
    end: 19_000,
    mateRefName: 'Pp03',
    mateStart: 1_000,
    mateEnd: 19_000,
  },
  {
    refName: 'chr2',
    start: 500,
    end: 9_500,
    mateRefName: 'Pp01',
    mateStart: 500,
    mateEnd: 9_500,
  },
  {
    refName: 'chr3',
    start: 200,
    end: 4_800,
    mateRefName: 'Pp02',
    mateStart: 200,
    mateEnd: 4_800,
  },
])

test('every contig on screen contributes its own mapped span', () => {
  expect(
    spread(
      [permuted],
      [win('chr1', 0, 20_000), win('chr2', 0, 10_000), win('chr3', 0, 5_000)],
    ).map(s => s.refName),
  ).toEqual(['Pp03', 'Pp01', 'Pp02'])
})

test('a contig with nothing aligned to it drops out rather than answering', () => {
  expect(
    spread([permuted], [win('chr1', 0, 20_000), win('chrUn', 0, 1_000)]).map(
      s => s.refName,
    ),
  ).toEqual(['Pp03'])
})

// The rung below this one holds a vote between the level's tracks so a sparse
// one cannot pull the row off the locus a dense one covers. Here there is no
// locus to be pulled off: a track covering a contig the other does not should
// widen the answer to reach it.
test('the tracks on a level are unioned rather than voted between', () => {
  const sparse = display([
    {
      refName: 'chr9',
      start: 100,
      end: 200,
      mateRefName: 'Pp09',
      mateStart: 100,
      mateEnd: 200,
    },
  ])
  expect(
    spread([permuted, sparse], [win('chr1', 0, 20_000), win('chr9', 0, 500)])
      .map(s => s.refName)
      .sort(),
  ).toEqual(['Pp03', 'Pp09'])
})

test('a track whose data has not arrived contributes nothing', () => {
  expect(
    spread(
      [{} as LinearSyntenyDisplayModel, permuted],
      [win('chr1', 0, 20_000)],
    ),
  ).toHaveLength(1)
})

// Which ANCHOR contigs answered, which the spans cannot say — they name the
// moving row's contigs. A refused spread's header offers the reader the ones
// worth scrolling onto, and a contig with no alignment in the file is not one.
test('reports the anchor contigs that mapped, not the ones asked about', () => {
  expect(
    followSpreadSpans({
      displays: [permuted],
      windows: [win('chr1', 0, 20_000), win('chrUn', 0, 1_000)],
      toMate: true,
    }).mapped,
  ).toEqual(new Set(['chr1']))
})
