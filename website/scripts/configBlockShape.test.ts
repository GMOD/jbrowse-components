/// <reference types="jest" />
import { configBlockShape } from './configBlockShape.ts'

test('the whole-track shorthand is a track, with or without name and type', () => {
  const shorthand = {
    trackId: 'reads',
    uri: 'https://example.com/reads.bam',
    assemblyNames: ['hg38'],
  }
  expect(configBlockShape(shorthand)).toBe('track')
  expect(configBlockShape({ ...shorthand, name: 'Reads' })).toBe('track')
  expect(
    configBlockShape({ ...shorthand, name: 'Reads', type: 'AlignmentsTrack' }),
  ).toBe('track')
})

test('a name over a uri with no trackId is still the assembly shorthand', () => {
  expect(
    configBlockShape({ name: 'hg38', uri: 'https://example.com/hg38.2bit' }),
  ).toBe('assembly')
})

test('a full track needs its type beside the adapter', () => {
  const adapter = { type: 'BamAdapter', uri: 'reads.bam' }
  expect(
    configBlockShape({ trackId: 'r', type: 'AlignmentsTrack', adapter }),
  ).toBe('track')
  expect(configBlockShape({ trackId: 'r', adapter })).toBe('other')
})
