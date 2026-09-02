import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { resolveFollowSpan } from './resolveFollowSpan.ts'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'
import type { FollowStep } from './planFollowStep.ts'

// The walk is the RPC, and what it answers is the whole question here.
jest.mock('../LinearSyntenyDisplay/moveMatchingPanel.ts', () => ({
  resolveMatchingSpan: jest.fn(),
}))
const walk = jest.mocked(resolveMatchingSpan)

beforeEach(() => {
  walk.mockReset()
})

const feat: FeatPos = {
  id: 'f0',
  name: 'f0',
  strand: 1,
  refName: 'chr1',
  start: 100_000,
  end: 110_000,
  assemblyName: 'grape',
  mate: {
    start: 1_100_000,
    end: 1_110_000,
    refName: 'Pp01',
    assemblyName: 'peach',
  },
  attributes: {},
}

// the one display getter the resolve reads: whether a coarse-tier walk is
// zoomed finer than the tier's threshold
function display(coarseWalkIsApproximate = false) {
  return { coarseWalkIsApproximate } as LinearSyntenyDisplayModel
}

function step(over: Partial<FollowStep> = {}): FollowStep {
  return {
    display: display(),
    feat,
    window: { refName: 'chr1', start: 102_000, end: 103_000 },
    toMate: true,
    hasCigar: true,
    windowInsideFeat: true,
    envelope: undefined,
    wantReversed: undefined,
    ...over,
  }
}

test('a walked answer is exact', async () => {
  walk.mockResolvedValue({ refName: 'Pp01', start: 1_102_500, end: 1_103_400 })
  await expect(resolveFollowSpan(step())).resolves.toEqual({
    span: { refName: 'Pp01', start: 1_102_500, end: 1_103_400 },
    approximate: false,
  })
})

test('a tier carrying no CIGAR interpolates, and says so', async () => {
  await expect(resolveFollowSpan(step({ hasCigar: false }))).resolves.toEqual({
    span: { refName: 'Pp01', start: 1_102_000, end: 1_103_000 },
    approximate: true,
  })
  expect(walk).not.toHaveBeenCalled()
})

// The case the plan cannot see. `hasCigar` is per-FETCH — true when ANY block in
// the response carried one — so a chain set with a few CIGAR-less rows, or a PAF
// concatenated from two runs, reaches the walk and gets nothing back. The
// placement was interpolated exactly as above, and the header used to report it
// as base-exact because only the plan wrote the flag.
test('a block with no CIGAR inside a fetch that has some also says so', async () => {
  walk.mockResolvedValue(undefined)
  await expect(resolveFollowSpan(step())).resolves.toEqual({
    span: { refName: 'Pp01', start: 1_102_000, end: 1_103_000 },
    approximate: true,
  })
})

test('an envelope is proportional by construction', async () => {
  const envelope = { refName: 'Pp01', start: 1_100_000, end: 1_110_000 }
  await expect(
    resolveFollowSpan(step({ windowInsideFeat: false, envelope })),
  ).resolves.toEqual({ span: envelope, approximate: true })
  // past one alignment there is no single block to walk
  expect(walk).not.toHaveBeenCalled()
})

// A walk through the coarse fold is within its `--coarse` gap, which is under a
// pixel wherever the tier is served automatically; a pinned coarse tier zoomed
// past its threshold is the one place the display says otherwise.
test('a walk through a coarse tier zoomed past its threshold is approximate', async () => {
  walk.mockResolvedValue({ refName: 'Pp01', start: 1_102_500, end: 1_103_400 })
  await expect(
    resolveFollowSpan(step({ display: display(true) })),
  ).resolves.toEqual({
    span: { refName: 'Pp01', start: 1_102_500, end: 1_103_400 },
    approximate: true,
  })
})
