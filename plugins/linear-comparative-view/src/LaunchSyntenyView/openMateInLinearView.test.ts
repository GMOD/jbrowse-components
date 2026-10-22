import { SimpleFeature } from '@jbrowse/core/util'

import { openMateInLinearView } from './openMateInLinearView.ts'

import type { MateViewHost } from './openMateInLinearView.ts'

test('a track spelling its mate assembly by an alias opens the canonical one', () => {
  const host = {
    assemblyManager: {
      has: (name: string) => name === 'hg38' || name === 'GRCh38',
      getCanonicalAssemblyName: (name: string) =>
        name === 'hg38' || name === 'GRCh38' ? 'hg38' : undefined,
    },
  } as unknown as MateViewHost
  const feature = new SimpleFeature({
    uniqueId: 'f1',
    refName: 'chr1',
    start: 0,
    end: 100,
    mate: { assemblyName: 'GRCh38', refName: 'chr1', start: 0, end: 100 },
  })
  expect(
    openMateInLinearView({ host, feature, viewId: 'v' })?.assemblyName,
  ).toBe('hg38')
})
