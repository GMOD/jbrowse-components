import { JBrowse } from '@jbrowse/react-app2'

// Four E. coli strains aligned all-vs-all (the E. coli pangenome demo from the
// all-vs-all synteny tutorial). Data hosted at jbrowse.org/demos/ecoli_pangenome.
const base = 'https://jbrowse.org/demos/ecoli_pangenome'

const strains = [
  { name: 'K12', displayName: 'E. coli K12' },
  { name: 'Sakai', displayName: 'E. coli Sakai' },
  { name: 'CFT073', displayName: 'E. coli CFT073' },
  { name: 'NCTC86', displayName: 'E. coli NCTC86' },
]

const assemblies = strains.map(({ name, displayName }) => ({
  name,
  displayName,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}-ref`,
    // bare `uri` shorthand: the .fai/.gzi siblings are derived automatically
    adapter: { type: 'BgzipFastaAdapter', uri: `${base}/${name}.fa.gz` },
  },
}))

// A single all-vs-all PAF whose assemblyNames list every strain, so one track
// can align any adjacent pair — this one SyntenyTrack backs all three bands.
const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'ecoli_ava',
    name: 'E. coli pangenome (all-vs-all PAF)',
    assemblyNames: strains.map(s => s.name),
    category: ['Synteny'],
    adapter: {
      type: 'AllVsAllPAFAdapter',
      pafLocation: { uri: `${base}/all_vs_all.paf.gz` },
      assemblyNames: strains.map(s => s.name),
    },
  },
]

export default function MultiwaySyntenyExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      views={[
        {
          type: 'LinearSyntenyView',
          init: {
            // four strain rows → three bands, all backed by ecoli_ava
            views: strains.map(s => ({ assembly: s.name })),
            tracks: [['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava']],
            drawCurves: true,
            // hide the short minimap2 alignments so the shared backbone reads
            // as clean ribbons instead of a dense noise band
            minAlignmentLength: 10000,
          },
        },
      ]}
    />
  )
}
