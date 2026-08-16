import { remapSelectionsToPairs } from './remapSelectionsToPairs.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'

const upload = (trackId: string, assemblyNames: string[]) =>
  ({
    type: 'userOpened',
    value: { trackId, assemblyNames },
  }) as unknown as ImportFormSyntenyTrack

test('a selection follows its pair to that pair’s new position', () => {
  // rows went [hg38, rn7, mm39] -> [hg38, mm39, rn7]. The rn7/mm39 pair was
  // pair 1 and still is; the None chosen for it goes with it
  expect(
    remapSelectionsToPairs(
      [{ type: 'preConfigured', value: 'picked' }, { type: 'none' }],
      ['hg38', 'rn7', 'mm39'],
      ['hg38', 'mm39', 'rn7'],
    ),
  ).toEqual([undefined, { type: 'none' }])
})

test('a finished upload follows its own baked assemblies', () => {
  // it can already be sitting on the wrong pair when the remap starts — that is
  // the state this gets out of — so its conf outranks its position. Here it is
  // parked on pair 1 (rn7/mm39) but was built for hg38/mm39, which is pair 0
  // of the new ordering
  expect(
    remapSelectionsToPairs(
      [undefined, upload('opened', ['hg38', 'mm39'])],
      ['hg38', 'rn7', 'mm39'],
      ['hg38', 'mm39', 'rn7'],
    ),
  ).toEqual([upload('opened', ['hg38', 'mm39']), undefined])
})

test('order within the pair does not matter (synteny is directionless)', () => {
  // the whole stack reversed, so pair 0 is the same two assemblies the other
  // way up and keeps what was configured for it
  expect(
    remapSelectionsToPairs(
      [{ type: 'preConfigured', value: 'picked' }],
      ['hg38', 'mm39'],
      ['mm39', 'hg38'],
    ),
  ).toEqual([{ type: 'preConfigured', value: 'picked' }])
})

test('a selection whose pair no longer exists is dropped', () => {
  expect(
    remapSelectionsToPairs(
      [upload('opened', ['hg38', 'mm39'])],
      ['hg38', 'mm39'],
      ['hg38', 'rn7'],
    ),
  ).toEqual([undefined])
})

test('a deliberate None stays on the pair it was chosen for', () => {
  // the bottom row changed, so pair 1 is a different pair and drops its
  // selection; pair 0 is untouched and keeps its None rather than sliding
  expect(
    remapSelectionsToPairs(
      [{ type: 'none' }, { type: 'preConfigured', value: 'picked' }],
      ['hg38', 'mm39', 'rn7'],
      ['hg38', 'mm39', 'panTro6'],
    ),
  ).toEqual([{ type: 'none' }, undefined])
})

test('a pending upload with no file yet still holds its pair', () => {
  // it has no baked assemblies to match on, but its pair survived, so the row
  // stays on "New track" rather than silently resetting under the user
  expect(
    remapSelectionsToPairs(
      [{ type: 'userOpened' }],
      ['hg38', 'mm39'],
      ['mm39', 'hg38'],
    ),
  ).toEqual([{ type: 'userOpened' }])
})

test('two selections over the same assemblies take one pair each', () => {
  const selections = [
    upload('a', ['hg38', 'hg38']),
    upload('b', ['hg38', 'hg38']),
  ]
  expect(
    remapSelectionsToPairs(
      selections,
      ['hg38', 'hg38', 'hg38'],
      ['hg38', 'hg38', 'hg38'],
    ),
  ).toEqual(selections)
})

// A self-alignment stack is the reachable case: one assembly holding both
// haplotypes, three rows of it, so every pair is the same assembly set. Only
// pairs that HELD a selection used to go into the pool, so the lower band's
// config was the first thing an identical-looking upper band matched, and
// Reverse rows or Auto-arrange moved it up a band.
test('a lower pair’s selection does not slide up between identical pairs', () => {
  expect(
    remapSelectionsToPairs(
      [undefined, { type: 'none' }],
      ['hg002', 'hg002', 'hg002'],
      ['hg002', 'hg002', 'hg002'],
    ),
  ).toEqual([undefined, { type: 'none' }])
})

test('an empty pair never blocks a selection that has to move', () => {
  // the empty source pair is a different assembly set, so it does not claim the
  // target the real selection is looking for
  expect(
    remapSelectionsToPairs(
      [undefined, { type: 'none' }],
      ['hg38', 'mm39', 'rn7'],
      ['mm39', 'rn7'],
    ),
  ).toEqual([{ type: 'none' }])
})

test('a row added at the bottom leaves every existing pair alone', () => {
  expect(
    remapSelectionsToPairs(
      [{ type: 'none' }],
      ['hg38', 'mm39'],
      ['hg38', 'mm39', 'rn7'],
    ),
  ).toEqual([{ type: 'none' }, undefined])
})
