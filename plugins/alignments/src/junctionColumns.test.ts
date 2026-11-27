import { JUNCTION_KINDS } from './features/junctions/junctionClass.ts'
import { mergeJunctions } from './features/junctions/junctions.ts'
import { junctionColumns } from './tables.ts'

import type { JunctionFilter } from './shared/types.ts'

const merged = [
  ...mergeJunctions(
    [
      {
        refName: 'chr1',
        data: {
          junctionX1: new Uint32Array(JUNCTION_KINDS.map((_, i) => 100 * i)),
          junctionX2: new Uint32Array(
            JUNCTION_KINDS.map((_, i) => 100 * i + 80),
          ),
          junctionCounts: new Uint32Array(JUNCTION_KINDS.length).fill(3),
          junctionFwd: new Uint32Array(JUNCTION_KINDS.length),
          junctionRev: new Uint32Array(JUNCTION_KINDS.length),
          junctionDonors: new Uint8Array(JUNCTION_KINDS.length),
          junctionAcceptors: new Uint8Array(JUNCTION_KINDS.length),
          junctionSplitClass: new Uint8Array(JUNCTION_KINDS.map((_, i) => i)),
        },
      },
    ],
    { minReads: 0 },
  ).values(),
]

function columns(filter: Omit<JunctionFilter, 'minReads'>) {
  return junctionColumns(
    merged,
    [],
    { junction: () => '#000000' },
    { junctions: { minReads: 0, ...filter } },
    () => 'coverage',
  )
}

test('a gap deletion is class deletion and source gap, with no level', () => {
  const { class: classes, source, level } = columns({})
  const at = JUNCTION_KINDS.indexOf('gapDeletion')
  expect([classes[at], source[at], level[at]]).toEqual(['deletion', 'gap', ''])
})

const FILTERS: Omit<JunctionFilter, 'minReads'>[] = [
  { sources: ['gap'] },
  { classes: ['deletion'] },
  { classes: ['deletion'], sources: ['gap'] },
  { sources: ['split'] },
]

test.each(FILTERS)(
  'shown agrees with the class and source columns under %j',
  filter => {
    const { class: classes, source, shown } = columns(filter)
    expect(shown).toEqual(
      classes.map(
        (c, i) =>
          (!filter.classes || filter.classes.includes(c)) &&
          (!filter.sources || filter.sources.includes(source[i]!)),
      ),
    )
  },
)
