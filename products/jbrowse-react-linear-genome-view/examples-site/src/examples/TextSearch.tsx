import { LinearGenomeView } from '@jbrowse/react-linear-genome-view2'

export default function TextSearch() {
  return (
    <LinearGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      aggregateTextSearchAdapters={[
        {
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/storybook_data/volvox.ix',
        },
      ]}
      tracks={[
        {
          trackId: 'gff3tabix_genes',
          name: 'Volvox genes',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
        },
      ]}
      view={{ loc: 'EDEN' }}
    />
  )
}
