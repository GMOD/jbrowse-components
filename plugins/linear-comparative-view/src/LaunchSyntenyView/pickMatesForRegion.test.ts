import { SimpleFeature } from '@jbrowse/core/util'

import { pickMatesForRegion } from './pickMatesForRegion.ts'

const TRACK_ASSEMBLIES = ['K12', 'Sakai', 'CFT073', 'IAI39']

function feat({
  id,
  start,
  end,
  mateAssembly,
  mateRefName = 'chr',
}: {
  id: string
  start: number
  end: number
  mateAssembly: string
  mateRefName?: string
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
      refName: mateRefName,
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
  }).mates.map(m => m.assemblyName)
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

// Several blocks of one mate over the same selection is the normal case, not a
// curiosity — an HSP table or a gene-anchor table is one row per hit — and the
// panel is framed on all of them. Keeping only the widest opened a fraction of
// what was selected and dropped the rest in silence.
test('every alignment of one mate assembly lands on its one panel', () => {
  const picked = pickMatesForRegion({
    features: [
      feat({ id: 'narrow', start: 1900, end: 2000, mateAssembly: 'Sakai' }),
      feat({ id: 'wide', start: 1000, end: 2000, mateAssembly: 'Sakai' }),
    ],
    region,
    trackAssemblyNames: TRACK_ASSEMBLIES,
    anchorAssembly: 'K12',
  })
  expect(picked.mates.length).toBe(1)
  expect(picked.mates[0]!.features.map(f => f.id())).toEqual(['narrow', 'wide'])
})

// A panel opens on one stable sequence, so blocks reaching a second contig of
// the same assembly (a rearrangement, a fragmented assembly) can't be unioned
// in — the span would cover neither. Overlap is measured against the region,
// not against the alignments' own length: a whole-chromosome block that barely
// clips the region should lose to a contig that covers it.
test('the mate contig covering most of the region wins, and only it', () => {
  const picked = pickMatesForRegion({
    features: [
      feat({ id: 'huge', start: 0, end: 1100, mateAssembly: 'Sakai' }),
      feat({
        id: 'covering',
        start: 1000,
        end: 2000,
        mateAssembly: 'Sakai',
        mateRefName: 'chr2',
      }),
    ],
    region,
    trackAssemblyNames: TRACK_ASSEMBLIES,
    anchorAssembly: 'K12',
  })
  expect(picked.mates[0]!.features.map(f => f.id())).toEqual(['covering'])
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

// Dropped, but not silently: an all-vs-all file holds every sample it was built
// with, so a locus can draw a dozen lanes in the track and offer no panel at
// all. Reporting that as "nothing aligns here" contradicts what the user is
// looking at, so the names come back for the dialog to say otherwise.
test('the mates with no declared assembly are reported, deduped and sorted', () => {
  expect(
    pickMatesForRegion({
      features: [
        feat({ id: 'x', start: 1000, end: 2000, mateAssembly: 'sampleZ' }),
        feat({ id: 'y', start: 1000, end: 1500, mateAssembly: 'sampleZ' }),
        feat({ id: 'z', start: 1000, end: 2000, mateAssembly: 'sampleA' }),
        feat({ id: 'ok', start: 1000, end: 2000, mateAssembly: 'Sakai' }),
      ],
      region,
      trackAssemblyNames: TRACK_ASSEMBLIES,
      anchorAssembly: 'K12',
    }),
  ).toMatchObject({
    mates: [{ assemblyName: 'Sakai' }],
    unconfigured: ['sampleA', 'sampleZ'],
  })
})

// the self lane is not "unconfigured" — it is deliberately excluded, and naming
// the anchor's own assembly as something that cannot open a panel would be
// nonsense next to the anchor row
test('the dropped self lane is not reported as unconfigured', () => {
  expect(
    pickMatesForRegion({
      features: [
        feat({ id: 'self', start: 1000, end: 2000, mateAssembly: 'K12' }),
      ],
      region,
      trackAssemblyNames: TRACK_ASSEMBLIES,
      anchorAssembly: 'K12',
    }).unconfigured,
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
    }).mates.map(m => m.assemblyName),
  ).toEqual(['K12'])
})
