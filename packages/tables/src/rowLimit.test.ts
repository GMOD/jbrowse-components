import { createTablesEngine } from './index.ts'
import { BAM } from './volvox.fixture.ts'

jest.mock(
  '../../../plugins/alignments/src/LinearAlignmentsDisplay/groupLayout.ts',
  () => ({
    ...jest.requireActual<object>(
      '../../../plugins/alignments/src/LinearAlignmentsDisplay/groupLayout.ts',
    ),
    MAX_LAYOUT_ROWS: 5,
  }),
)

const engine = createTablesEngine()

test('reads stacking past the pileup’s row limit are refused, not laid over the rows above', async () => {
  await expect(engine.alignments(BAM)).rejects.toThrow(
    /^ctgA:1000-6000 stacks reads more than 5 rows deep, the pileup’s row limit; read a smaller region$/,
  )
})
