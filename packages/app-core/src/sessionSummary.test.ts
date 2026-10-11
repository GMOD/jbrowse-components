import { formatSessionSummary, summarizeSession } from './sessionSummary.ts'

const lgv = (assemblyName: string, tracks: number) => ({
  type: 'LinearGenomeView',
  displayedRegions: [
    { assemblyName, refName: 'chr1', start: 0, end: 100 },
    { assemblyName, refName: 'chr2', start: 0, end: 100 },
  ],
  tracks: Array.from({ length: tracks }, (_, i) => ({
    type: 'FeatureTrack',
    configuration: `t${i}`,
  })),
})

test('counts top-level views and every track, nested views included', () => {
  const summary = summarizeSession({
    id: 's',
    views: [
      lgv('hg38', 3),
      {
        type: 'LinearSyntenyView',
        views: [lgv('hg38', 1), lgv('mm39', 2)],
        tracks: [{ type: 'SyntenyTrack', configuration: 'hg38_mm39' }],
      },
    ],
  })
  expect(summary).toEqual({ assemblies: ['hg38', 'mm39'], views: 2, tracks: 7 })
  expect(formatSessionSummary(summary)).toBe('hg38, mm39 · 2 views · 7 tracks')
})

test('reads a dotplot-style assemblyNames list', () => {
  expect(
    summarizeSession({
      views: [{ type: 'DotplotView', assemblyNames: ['a', 'b', 'c'] }],
    }).assemblies,
  ).toEqual(['a', 'b', 'c'])
})

test('formats the empty and the many-assembly cases', () => {
  expect(formatSessionSummary(summarizeSession({ views: [] }))).toBe('No views')
  expect(
    formatSessionSummary({
      assemblies: ['a', 'b', 'c', 'd'],
      views: 1,
      tracks: 1,
    }),
  ).toBe('a, b +2 more · 1 view · 1 track')
})
