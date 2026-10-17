import {
  SV_CHANNELS_LABEL,
  SV_CHANNELS_ON,
} from '../../plugins/alignments/src/LinearAlignmentsDisplay/menus/svChannelsPreset.ts'
import { takeArrangement } from '../src/lib/spec-recipe/arrangements.ts'
import { flatSettings } from '../src/lib/spec-recipe/decode.ts'

const ALIGNMENTS = 'LinearAlignmentsDisplay'

// A spec entry's settings, in the shape specTrackSettings hands over: each
// band object flattened to its dotted members.
function entries(extra: Record<string, unknown> = {}) {
  return [...flatSettings(SV_CHANNELS_ON), ...flatSettings(extra)]
}

test('the arrangement is one step, and its settings leave the per-field walk', () => {
  const { step, rest } = takeArrangement(entries(), ALIGNMENTS)
  expect(step?.path).toBe(
    `Track menu → Read connections → ${SV_CHANNELS_LABEL}`,
  )
  expect(rest).toEqual([])
})

test('a setting the arrangement does not name walks on', () => {
  const { step, rest } = takeArrangement(
    entries({ coverage: { height: 60 } }),
    ALIGNMENTS,
  )
  expect(step).toBeDefined()
  expect(rest).toEqual([['coverage.height', 60]])
})

// The point of the presence half: a spec one setting short produces a different
// picture, so it gets the per-field walk rather than an instruction to click a
// row that would also change the setting it left out.
test.each(flatSettings(SV_CHANNELS_ON).map(([field]) => field))(
  'a spec that omits %s is not the arrangement',
  field => {
    const short = entries().filter(([name]) => name !== field)
    const { step, rest } = takeArrangement(short, ALIGNMENTS)
    expect(step).toBeUndefined()
    expect(rest).toEqual(short)
  },
)

// isSvChannelsActive leaves readConnections.placement out of the match on
// purpose, so the arrangement still resolves — but the reader has to flip that
// row by hand, which means it may not be swallowed.
test('arcs on the other side of the band stay in the arrangement, and keep a step', () => {
  const { step, rest } = takeArrangement(
    entries({ readConnections: { placement: 'up' } }),
    ALIGNMENTS,
  )
  expect(step).toBeDefined()
  expect(rest).toEqual([['readConnections.placement', 'up']])
})

test('another display type spelling the same settings is not the arrangement', () => {
  const { step } = takeArrangement(entries(), 'LinearBasicDisplay')
  expect(step).toBeUndefined()
})

test('an entry that named no display type is not the arrangement', () => {
  const { step } = takeArrangement(entries(), undefined)
  expect(step).toBeUndefined()
})
