import {
  EmbedProvider,
  RegionSeams,
  Scalebar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const chromosomes = [
  ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
  'chrX',
  'chrY',
]

const EveryChromosome = observer(function EveryChromosome() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
    },
    tracks: [
      {
        trackId: 'hg38_alu_density',
        name: 'Alu per kb',
        uri: 'https://jbrowse.org/demos/gene_density/Alu.bed.density.bw',
        displayDefaults: {
          height: 120,
          encoding: { color: { value: '#3a7ca5' } },
        },
      },
    ],
    view: {
      loc: chromosomes.join(' '),
      tracks: ['hg38_alu_density'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <TrackStack view={session.view}>
        <Scalebar view={session.view} />
        <RegionSeams view={session.view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default EveryChromosome
