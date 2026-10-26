import { EmbedProvider, TrackStack } from '@jbrowse/display-ui/embed'
import { SyntenyStack } from '@jbrowse/plugin-linear-comparative-view'
import { useCreateViewState } from '@jbrowse/react-app2'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'

const geneTrack = (assembly: string) => ({
  trackId: `${assembly}_genes`,
  name: `RefSeq curated (${assembly})`,
  uri: `https://jbrowse.org/ucsc/${assembly}/ncbiRefSeqCurated.gff.gz`,
  index: `https://jbrowse.org/ucsc/${assembly}/ncbiRefSeqCurated.gff.gz.csi`,
  assemblyNames: [assembly],
  displayDefaults: { height: 110, geneGlyphMode: 'representative' },
})

const chromSizes = (assembly: string) => ({
  name: assembly,
  uri: `https://jbrowse.org/ucsc/${assembly}/${assembly}.chrom.sizes`,
})

const Synteny = observer(function Synteny() {
  const state = useCreateViewState({
    config: {
      assemblies: [chromSizes('hg38'), chromSizes('mm39')],
      tracks: [
        geneTrack('hg38'),
        geneTrack('mm39'),
        {
          type: 'SyntenyTrack',
          trackId: 'hg38_mm39',
          name: 'Human vs mouse (UCSC liftOver)',
          assemblyNames: ['hg38', 'mm39'],
          adapter: {
            type: 'PairwiseIndexedPAFAdapter',
            uri: 'https://jbrowse.org/ucsc/hg38/liftOver/hg38ToMm39.over.pif.gz',
            csi: true,
            assemblyNames: ['mm39', 'hg38'],
          },
        },
      ],
      defaultSession: {
        name: 'synteny',
        views: [
          {
            type: 'LinearSyntenyView',
            views: [
              {
                assembly: 'hg38',
                loc: 'chr17:43,040,000..43,130,000',
                tracks: ['hg38_genes'],
              },
              {
                assembly: 'mm39',
                loc: 'chr11:101,375,000..101,447,000',
                tracks: ['mm39_genes'],
              },
            ],
            tracks: ['hg38_mm39'],
            mark: { interpolate: 'bump' },
            indels: { encoding: { opacity: 0 } },
          },
        ],
      },
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <SyntenyStack
        view={session.views[0] as LinearSyntenyViewModel}
        renderRow={row => (
          <TrackStack view={row}>
            <div style={{ fontSize: '0.7rem', opacity: 0.7, padding: 2 }}>
              {row.assemblyNames[0]}
            </div>
          </TrackStack>
        )}
      />
    </EmbedProvider>
  )
})

export default Synteny
