import { SimpleFeature } from '@jbrowse/core/util'

import { pickMatesForRegion } from './pickMatesForRegion.ts'

const TRACK_ASSEMBLIES = ['K12', 'Sakai', 'CFT073', 'IAI39']

function feat({
  id,
  start,
  end,
  mateAssembly,
}: {
  id: string
  start: number
  end: number
  mateAssembly: string
}) {
  return new SimpleFeature({
    uniqueId: id,
    assemblyName: 'K12',
    refName: 'chr',
    start,
    end,
    strand: 1,
    mate: {
      assemblyName: mateAssembly,
      refName: 'chr',
      start,
      end,
    },
  })
}

const region = { start: 1000, end: 2000 }

function names(
  features: ReturnType<typeof feat>[],
  anchorAssembly = 'K12',
): string[] {
  return pickMatesForRegion({
    features,
    region,
    trackAssemblyNames: TRACK_ASSEMBLIES,
    anchorAssembly,
  }).map(m => m.assemblyName)
}

test('one panel per mate assembly, in the track declaration order', () => {
  expect(
    names([
      feat({ id: 'a', start: 1000, end: 2000, mateAssembly: 'IAI39' }),
      feat({ id: 'b', start: 1000, end: 2000, mateAssembly: 'Sakai' }),
      feat({ id: 'c', start: 1000, end: 2000, mateAssembly: 'CFT073' }),
    ]),
  ).toEqual(['Sakai', 'CFT073', 'IAI39'])
})

test('the widest alignment wins when an assembly has several at the locus', () => {
  const picked = pickMatesForRegion({
    features: [
      feat({ id: 'narrow', start: 1900, end: 2000, mateAssembly: 'Sakai' }),
      feat({ id: 'wide', start: 1000, end: 2000, mateAssembly: 'Sakai' }),
    ],
    region,
    trackAssemblyNames: TRACK_ASSEMBLIES,
    anchorAssembly: 'K12',
  })
  expect(picked.map(m => m.feature.id())).toEqual(['wide'])
})

// overlap is measured against the region, not against the alignment's own
// length: a whole-chromosome block that barely clips the region should lose to
// one that covers it
test('overlap is measured against the region, not the alignment length', () => {
  const picked = pickMatesForRegion({
    features: [
      feat({ id: 'huge', start: 0, end: 1100, mateAssembly: 'Sakai' }),
      feat({ id: 'covering', start: 1000, end: 2000, mateAssembly: 'Sakai' }),
    ],
    region,
    trackAssemblyNames: TRACK_ASSEMBLIES,
    anchorAssembly: 'K12',
  })
  expect(picked.map(m => m.feature.id())).toEqual(['covering'])
})

test('the self lane is dropped', () => {
  expect(
    names([
      feat({ id: 'self', start: 1000, end: 2000, mateAssembly: 'K12' }),
      feat({ id: 'b', start: 1000, end: 2000, mateAssembly: 'Sakai' }),
    ]),
  ).toEqual(['Sakai'])
})

// the one-vs-all case the pairwise launch already guards: a mate that resolved
// to a bare PanSN sample label is not an assembly the view could open
test('a mate that is not a declared assembly is dropped', () => {
  expect(
    names([feat({ id: 'x', start: 1000, end: 2000, mateAssembly: 'sampleZ' })]),
  ).toEqual([])
})

// A track declaring one assembly twice is a genome against its own paralogy, so
// its self lane is the comparison rather than noise beside one. The pairwise
// right-click launch always allowed it; dropping it here left the region launch
// saying nothing aligned on exactly the tracks where everything does.
test('a self-alignment track keeps its own lane, once', () => {
  expect(
    pickMatesForRegion({
      features: [
        feat({ id: 'a', start: 1000, end: 2000, mateAssembly: 'K12' }),
      ],
      region,
      trackAssemblyNames: ['K12', 'K12'],
      anchorAssembly: 'K12',
    }).map(m => m.assemblyName),
  ).toEqual(['K12'])
})
