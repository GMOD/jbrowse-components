import { useState } from 'react'

import { EmbedProvider, Toolbar, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const modes = ['light', 'dark'] as const

const DarkTheme = observer(function DarkTheme() {
  const [mode, setMode] = useState<(typeof modes)[number]>('dark')
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
        trackId: 'hg38_phylop',
        name: 'phyloP 100-way conservation',
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: { height: 100 },
      },
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
    ],
    view: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop', 'hg38_genes'],
    },
  })
  return state ? (
    <EmbedProvider session={state.session} mode={mode}>
      <div
        style={{
          colorScheme: mode,
          color: 'CanvasText',
          background: 'Canvas',
          padding: 8,
        }}
      >
        <Toolbar>
          {modes.map(name => (
            <label key={name}>
              <input
                type="radio"
                name="mode"
                checked={mode === name}
                onChange={() => {
                  setMode(name)
                }}
              />
              {name}
            </label>
          ))}
        </Toolbar>
        <TrackStack view={state.session.view} />
      </div>
    </EmbedProvider>
  ) : null
})

export default DarkTheme
