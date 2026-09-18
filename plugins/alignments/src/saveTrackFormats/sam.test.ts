import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { stringifySAM } from './sam.ts'

import type { AssemblyHost } from '@jbrowse/core/util'

// A BAM spelling its contigs `1`, `2` on an assembly whose canonical names are
// `chr1`, `chr2`: the header lists the assembly's, so the records must too, or
// samtools rejects every one as naming a reference the header lacks.
test('records name their references the way the header does', () => {
  const aliases: Record<string, string> = { '1': 'chr1', '2': 'chr2' }
  const session = {
    assemblyManager: {
      get: () => ({
        regions: [
          { refName: 'chr1', start: 0, end: 1000 },
          { refName: 'chr2', start: 0, end: 1000 },
        ],
        getCanonicalRefName2: (refName: string) => aliases[refName] ?? refName,
      }),
    },
  } as unknown as AssemblyHost
  const feature = new SimpleFeature({
    uniqueId: 'r1',
    refName: '1',
    start: 99,
    end: 103,
    name: 'r1',
    flags: 1,
    CIGAR: '4M',
    next_ref: '2',
    next_pos: 499,
  })
  const [record] = stringifySAM({
    features: [feature],
    session,
    assemblyName: 'hg38',
  })
    .split('\n')
    .filter(line => line && !line.startsWith('@'))
  const fields = record!.split('\t')
  expect(fields[2]).toBe('chr1')
  expect(fields[6]).toBe('chr2')
})
