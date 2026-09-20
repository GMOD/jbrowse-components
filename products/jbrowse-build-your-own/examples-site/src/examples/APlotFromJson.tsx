import {
  EmbedProvider,
  Legend,
  Scalebar,
  TrackStack,
  TrackToggle,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

const lineage = {
  type: 'formula',
  expr: 'jexl:substring(feature.name, 0, 4)',
  as: ['lineage'],
}

const color = {
  field: 'lineage',
  scale: 'categorical',
  domain: ['AluJ', 'AluS', 'AluY', 'FLAM', 'FRAM'],
  palette: ['#4575b4', '#fdae61', '#d73027', '#8c8c8c', '#8c8c8c'],
}

const aluTrack = (
  trackId: string,
  name: string,
  transform: Record<string, unknown>[],
) => ({
  type: 'FeatureTrack',
  trackId,
  name,
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    uri: 'https://jbrowse.org/demos/gene_density/Alu.bed.gz',
  },
  displays: [
    {
      type: 'LinearMarkDisplay',
      displayId: `${trackId}-LinearMarkDisplay`,
      height: 140,
      showLegend: false,
      marks: [
        {
          shape: 'bar',
          transform,
          encoding: { y: 'milliDiv', color },
        },
      ],
    },
  ],
})

const APlotFromJson = observer(function APlotFromJson() {
  const state = useCreateViewState({
    assembly: {
      name: 'hg38',
      uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
      refNameAliases: {
        uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
      },
      geneticCodes: { chrM: 2 },
    },
    tracks: [
      aluTrack('alu_age', 'Every Alu copy', [lineage]),
      aluTrack('alu_young', 'AluY only', [
        lineage,
        { type: 'filter', expr: "jexl:startsWith(feature.name, 'AluY')" },
      ]),
    ],
    init: {
      loc: 'chr1:151,000,000..151,030,000',
      tracks: ['alu_age'],
    },
  })
  if (!state) {
    return null
  }
  const { view } = state.session
  const display = view.getTrack('alu_age')?.activeDisplay as
    | { legendSpec: LegendSpec }
    | undefined
  return (
    <EmbedProvider session={state.session}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          paddingBottom: 6,
          fontSize: '0.85rem',
        }}
      >
        <TrackToggle view={view} trackId="alu_age">
          Every Alu copy
        </TrackToggle>
        <TrackToggle view={view} trackId="alu_young">
          AluY only
        </TrackToggle>
        {display ? <Legend display={display} /> : null}
      </div>
      <TrackStack view={view}>
        <Scalebar view={view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default APlotFromJson
