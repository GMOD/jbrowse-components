import { readConfObject } from '@jbrowse/core/configuration'

import { getSharedTracks, rowsToViewInits, swap } from './importFormUtils.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

test('swap exchanges two elements without mutating the original', () => {
  const arr = ['a', 'b', 'c']
  expect(swap(arr, 0, 2)).toEqual(['c', 'b', 'a'])
  expect(swap(arr, 0, 1)).toEqual(['b', 'a', 'c'])
  expect(arr).toEqual(['a', 'b', 'c'])
})

test('rowsToViewInits maps blank loc to undefined (whole assembly)', () => {
  expect(
    rowsToViewInits(
      [
        { assembly: 'hg38', loc: 'chr1:100-200' },
        { assembly: 'hg38', loc: '' },
      ],
      '',
    ),
  ).toEqual([
    { assembly: 'hg38', loc: 'chr1:100-200', tracks: undefined },
    { assembly: 'hg38', loc: undefined, tracks: undefined },
  ])
})

test('getSharedTracks keeps only tracks covering all selected assemblies', () => {
  const tracks = [
    { trackId: 'a', assemblyNames: ['hg38'] },
    { trackId: 'b', assemblyNames: ['hg38', 'hg19'] },
    { trackId: 'c', assemblyNames: ['mm10'] },
    { trackId: 'noAssemblies' },
  ] as unknown as AnyConfigurationModel[]

  const ids = (assemblies: string[]) =>
    getSharedTracks(tracks, assemblies).map(t => readConfObject(t, 'trackId'))

  expect(ids(['hg38'])).toEqual(['a', 'b'])
  expect(ids(['hg38', 'hg19'])).toEqual(['b'])
  expect(ids(['mm10'])).toEqual(['c'])
  expect(ids(['hg38', 'mm10'])).toEqual([])
})

test('rowsToViewInits opens the shared track in every row', () => {
  expect(
    rowsToViewInits(
      [
        { assembly: 'hg38', loc: 'chr1:100' },
        { assembly: 'hg38', loc: 'chr5:900' },
        { assembly: 'hg38', loc: '' },
      ],
      'mytrack',
    ),
  ).toEqual([
    { assembly: 'hg38', loc: 'chr1:100', tracks: ['mytrack'] },
    { assembly: 'hg38', loc: 'chr5:900', tracks: ['mytrack'] },
    { assembly: 'hg38', loc: undefined, tracks: ['mytrack'] },
  ])
})
