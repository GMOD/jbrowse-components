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

// the tags as a serialized volvox read carries them, plus the shapes it does
// not: a B array, a float, a one-letter Z, and two values SAM has no type for
test('optional tags follow the eleven columns, typed by their values', () => {
  const session = {
    assemblyManager: { get: () => undefined },
  } as unknown as AssemblyHost
  const feature = new SimpleFeature({
    uniqueId: 'r1',
    refName: 'ctgA',
    start: 0,
    end: 4,
    name: 'r1',
    CIGAR: '4M',
    tags: {
      XT: 'U',
      NM: 3,
      MD: '46T30T4A17',
      RG: '1',
      XS: 1.5,
      ML: [255, 0, 12],
      ZZ: { nested: true },
      xyz: 'not a tag key',
    },
  })
  const record = stringifySAM({
    features: [feature],
    session,
    assemblyName: 'volvox',
  })
    .split('\n')
    .find(line => line.startsWith('r1'))!
  expect(record.split('\t').slice(11)).toEqual([
    'XT:Z:U',
    'NM:i:3',
    'MD:Z:46T30T4A17',
    'RG:Z:1',
    'XS:f:1.5',
    'ML:B:i,255,0,12',
  ])
})
