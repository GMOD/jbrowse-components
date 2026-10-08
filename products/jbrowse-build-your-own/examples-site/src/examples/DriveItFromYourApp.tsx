import {
  EmbedProvider,
  LocationBox,
  NavButton,
  RegionSeams,
  Toolbar,
  TrackStack,
  TrackToggle,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const catalogue = [
  { id: 'hg38_phylop', label: 'Conservation' },
  { id: 'hg38_genes', label: 'Genes' },
  { id: 'na12878_exome', label: 'Reads' },
]

const bookmarks = [
  { label: 'BRCA1', loc: 'chr17:43,044,295..43,125,364' },
  { label: 'A whole chromosome', loc: 'chr17' },
  {
    label: 'Two regions at once',
    loc: 'chr17:43,044,295..43,060,000 chr17:43,100,000..43,125,364',
  },
  {
    label: 'Two BRCA genes',
    loc: 'chr17:43,044,295..43,125,364 chr13:32,315,474..32,400,266',
  },
]

const Controls = observer(function Controls({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  return (
    <Toolbar>
      <LocationBox view={view} />
      <span>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => {
            view.zoom(view.bpPerPx * 2)
          }}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => {
            view.zoom(view.bpPerPx / 2)
          }}
        >
          +
        </button>
      </span>
      {bookmarks.map(({ label, loc }) => (
        <NavButton key={label} view={view} loc={loc}>
          {label}
        </NavButton>
      ))}
      {catalogue.map(({ id, label }) => (
        <TrackToggle key={id} view={view} trackId={id}>
          {label}
        </TrackToggle>
      ))}
    </Toolbar>
  )
})

const DriveItFromYourApp = observer(function DriveItFromYourApp() {
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
        uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
        displayDefaults: { height: 100, color: '#3a7ca5' },
      },
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
      {
        trackId: 'na12878_exome',
        name: 'NA12878 exome reads',
        uri: 'https://jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        displayDefaults: { height: 150 },
      },
    ],
    view: {
      loc: 'chr17:43,044,295..43,125,364',
      tracks: ['hg38_phylop', 'hg38_genes'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <Controls view={session.view} />
      <TrackStack view={session.view}>
        <RegionSeams view={session.view} />
      </TrackStack>
    </EmbedProvider>
  )
})

export default DriveItFromYourApp
