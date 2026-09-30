/// <reference types="jest" />
import { deriveAddTrackArgs } from './derive-add-track.ts'

const FULL = {
  type: 'AlignmentsTrack',
  trackId: 'reads',
  name: 'Sample reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/reads.bam' },
}

const SHORTHAND = {
  trackId: 'reads',
  uri: 'https://example.com/reads.bam',
  assemblyNames: ['hg38'],
}

test('the whole-track shorthand derives the command its full form does', () => {
  expect(deriveAddTrackArgs({ ...SHORTHAND, name: 'Sample reads' })).toEqual(
    deriveAddTrackArgs(FULL),
  )
  expect(
    deriveAddTrackArgs({
      ...SHORTHAND,
      name: 'Sample reads',
      type: 'AlignmentsTrack',
    }),
  ).toEqual(deriveAddTrackArgs(FULL))
})

test('a shorthand with no name is named after its file, as the app names it', () => {
  expect(deriveAddTrackArgs(SHORTHAND)).toEqual([
    'add-track',
    'https://example.com/reads.bam',
    '--trackId',
    'reads',
    '--name',
    'reads.bam',
    '--assemblyNames',
    'hg38',
  ])
})

test('a shorthand overriding the track type passes it on', () => {
  expect(deriveAddTrackArgs({ ...SHORTHAND, type: 'FeatureTrack' })).toEqual(
    expect.arrayContaining(['--trackType', 'FeatureTrack']),
  )
})

test('a shorthand naming its index passes it as --indexFile', () => {
  expect(
    deriveAddTrackArgs({ ...SHORTHAND, index: 'https://example.com/r.csi' }),
  ).toEqual(expect.arrayContaining(['--indexFile', 'https://example.com/r.csi']))
})

test('a shorthand with a baseUri has no add-track equivalent', () => {
  expect(
    deriveAddTrackArgs({ ...SHORTHAND, baseUri: 'https://example.com/' }),
  ).toBeNull()
})

test('a shorthand no format claims has no add-track equivalent', () => {
  expect(
    deriveAddTrackArgs({ ...SHORTHAND, uri: 'https://example.com/r.xyz' }),
  ).toBeNull()
})

test('the track type read off the file decides whether --trackType is needed', () => {
  const bedmethyl = {
    trackId: 'm',
    name: 'm',
    assemblyNames: ['hg38'],
    adapter: { type: 'BedTabixAdapter', uri: 'calls.bedmethyl.gz' },
  }
  expect(
    deriveAddTrackArgs({ ...bedmethyl, type: 'MultiQuantitativeTrack' }),
  ).not.toContain('--trackType')
  expect(deriveAddTrackArgs({ ...bedmethyl, type: 'FeatureTrack' })).toEqual(
    expect.arrayContaining(['--trackType', 'FeatureTrack']),
  )
})
