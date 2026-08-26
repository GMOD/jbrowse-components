import {
  SV_CHANNELS_LABEL,
  SV_CHANNELS_ON,
} from '../../plugins/alignments/src/LinearAlignmentsDisplay/menus/svChannelsPreset.ts'
import { takeArrangement } from '../src/lib/spec-recipe/arrangements.ts'

const ALIGNMENTS = 'LinearAlignmentsDisplay'

// A spec entry's settings, in the shape specTrackSettings hands over.
function entries(extra: Record<string, unknown> = {}) {
  return Object.entries({ ...SV_CHANNELS_ON, ...extra })
}

test('the arrangement is one step, and its settings leave the per-field walk', () => {
  const { step, rest } = takeArrangement(entries(), ALIGNMENTS)
  expect(step?.path).toBe(`Track menu → ${SV_CHANNELS_LABEL}`)
  expect(rest).toEqual([])
})

test('a setting the arrangement does not name walks on', () => {
  const { step, rest } = takeArrangement(
    entries({ coverageHeight: 60 }),
    ALIGNMENTS,
  )
  expect(step).toBeDefined()
  expect(rest).toEqual([['coverageHeight', 60]])
})

// The point of the presence half: a spec one setting short produces a different
// picture, so it gets the per-field walk rather than an instruction to click a
// row that would also change the setting it left out.
test.each(Object.keys(SV_CHANNELS_ON))(
  'a spec that omits %s is not the arrangement',
  field => {
    const short = entries().filter(([name]) => name !== field)
    const { step, rest } = takeArrangement(short, ALIGNMENTS)
    expect(step).toBeUndefined()
    expect(rest).toEqual(short)
  },
)

// isSvChannelsActive leaves readConnectionsDown out of the match on purpose, so
// the arrangement still resolves — but the reader has to flip that row by hand,
// which means it may not be swallowed.
test('arcs on the other side of the band stay in the arrangement, and keep a step', () => {
  const { step, rest } = takeArrangement(
    entries({ readConnectionsDown: false }),
    ALIGNMENTS,
  )
  expect(step).toBeDefined()
  expect(rest).toEqual([['readConnectionsDown', false]])
})

test('another display type spelling the same settings is not the arrangement', () => {
  const { step } = takeArrangement(entries(), 'LinearBasicDisplay')
  expect(step).toBeUndefined()
})

test('an entry that named no display type is not the arrangement', () => {
  const { step } = takeArrangement(entries(), undefined)
  expect(step).toBeUndefined()
})
