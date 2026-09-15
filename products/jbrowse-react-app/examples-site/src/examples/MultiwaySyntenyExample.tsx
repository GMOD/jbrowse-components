import { JBrowse } from '@jbrowse/react-app2'

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
    adapter: { type: 'BgzipFastaAdapter', uri: `${base}/${name}.fa.gz` },
  },
}))

const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'ecoli_ava',
    name: 'E. coli pangenome (all-vs-all PAF)',
    assemblyNames: strains.map(s => s.name),
    category: ['Synteny'],
    adapter: {
      type: 'MultiGenomePAFAdapter',
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
          views: strains.map(s => ({ assembly: s.name })),
          tracks: [['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava']],
          drawCurves: true,
          minAlignmentLength: 10000,
        },
      ]}
    />
  )
}
