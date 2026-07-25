import { remapUploadsToPairs } from './remapUploadsToPairs.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'

const upload = (trackId: string, assemblyNames: string[]) =>
  ({
    type: 'userOpened',
    value: { trackId, assemblyNames },
  }) as unknown as ImportFormSyntenyTrack

test('an upload follows its assemblies to their new pair position', () => {
  // rows went [hg38, rn7, mm39] -> [hg38, mm39, rn7], so the hg38/mm39 upload
  // moves from pair 1 to pair 0
  const remapped = remapUploadsToPairs(
    [undefined, upload('opened', ['hg38', 'mm39'])],
    ['hg38', 'mm39', 'rn7'],
  )
  expect(remapped).toEqual([upload('opened', ['hg38', 'mm39']), undefined])
})

test('order within the pair does not matter (synteny is directionless)', () => {
  expect(
    remapUploadsToPairs(
      [upload('opened', ['mm39', 'hg38'])],
      ['hg38', 'mm39'],
    )[0],
  ).toMatchObject({ type: 'userOpened' })
})

test('an upload with no adjacent pair left is dropped', () => {
  expect(
    remapUploadsToPairs([upload('opened', ['hg38', 'mm39'])], ['hg38', 'rn7']),
  ).toEqual([undefined])
})

test('preConfigured picks are not carried over, so each pair re-picks', () => {
  expect(
    remapUploadsToPairs(
      [{ type: 'preConfigured', value: 'picked' }, { type: 'none' }],
      ['hg38', 'mm39', 'rn7'],
    ),
  ).toEqual([undefined, undefined])
})

test('a pending upload with no file yet has nothing to carry', () => {
  expect(
    remapUploadsToPairs([{ type: 'userOpened' }], ['hg38', 'mm39']),
  ).toEqual([undefined])
})

test('two uploads over the same assemblies take one pair each', () => {
  const selections = [
    upload('a', ['hg38', 'hg38']),
    upload('b', ['hg38', 'hg38']),
  ]
  const remapped = remapUploadsToPairs(selections, ['hg38', 'hg38', 'hg38'])
  expect(remapped).toEqual(selections)
})
