import {
  EmbedProvider,
  Highlights,
  NavButton,
  Toolbar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

const hits = [
  {
    label: 'BRCA1',
    loc: 'chr17:43,020,000..43,150,000',
    highlight: {
      assemblyName: 'hg38',
      refName: 'chr17',
      start: 43044295,
      end: 43125364,
      label: 'BRCA1',
    },
  },
  {
    label: 'A single base',
    loc: 'chr17:43,020,000..43,150,000',
    highlight: {
      assemblyName: 'hg38',
      refName: 'chr17',
      start: 43090000,
      end: 43090001,
      color: 'rgba(217, 119, 6, 0.45)',
      label: 'one base, mid-intron',
    },
  },
  {
    label: 'Off the end of the chromosome',
    loc: 'chr17:83,200,000..83,257,441',
    highlight: {
      assemblyName: 'hg38',
      refName: 'chr17',
      start: 83250000,
      end: 83300000,
      label: 'clipped to the chromosome',
    },
  },
]

const HighlightARegion = observer(function HighlightARegion() {
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
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 140 },
      },
    ],
    view: {
      loc: hits[0]!.loc,
      tracks: ['hg38_genes'],
      highlight: [hits[0]!.highlight],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  const { view } = session
  return (
    <EmbedProvider session={session}>
      <Toolbar>
        {hits.map(({ label, loc, highlight }) => (
          <NavButton
            key={label}
            view={view}
            loc={loc}
            onClick={() => {
              session.setHighlights([highlight])
            }}
          >
            {label}
          </NavButton>
        ))}
        <label>
          <input
            type="checkbox"
            checked={session.highlightsVisible}
            onChange={event => {
              session.setHighlightsVisible(event.target.checked)
            }}
          />
          Show highlights
        </label>
      </Toolbar>
      <TrackStack view={view}>
        <Highlights view={view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default HighlightARegion
