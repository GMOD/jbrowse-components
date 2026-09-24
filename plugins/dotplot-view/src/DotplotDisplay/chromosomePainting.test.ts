import { createTestSession } from '@jbrowse/web/testUtils'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

// A PAF names its contigs in the FILE's spelling, which the worker ships as
// is: `1` against an assembly whose canonical name is `chr1`. Chromosome
// painting hands its palette out by the assembly's own order, and a probe that
// misses is silent — the color function falls back to a hash color. So the
// position has to resolve aliases, which is what this assembly exercises.
test('an alias paints at its chromosome position in the assembly order', async () => {
  const session = createTestSession({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'grch',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'grch-seq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: ['chr1', 'chr2', 'chr3'].map(refName => ({
                refName,
                uniqueId: refName,
                start: 0,
                end: 10,
                seq: 'ACGTACGTAC',
              })),
            },
          },
          refNameAliases: {
            adapter: {
              type: 'FromConfigAdapter',
              features: [
                { refName: 'chr2', uniqueId: 'a2', aliases: ['2'] },
                { refName: 'chr3', uniqueId: 'a3', aliases: ['3'] },
              ],
            },
          },
        },
      ],
    },
  })
  const assembly = await session.assemblyManager.waitForAssembly('grch')
  expect(assembly?.getRefNamePosition('chr3')).toBe(2)
  expect(assembly?.getRefNamePosition('3')).toBe(2)
  expect(assembly?.getRefNamePosition('2')).toBe(1)
  expect(assembly?.getRefNamePosition('scaffold_77')).toBeUndefined()
})
