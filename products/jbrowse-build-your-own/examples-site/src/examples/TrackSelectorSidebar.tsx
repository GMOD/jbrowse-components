import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import {
  EmbedProvider,
  TrackStack,
  TrackToggle,
} from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { ViewModel } from '@jbrowse/react-linear-genome-view2'

type Session = ViewModel['session']

const variantTrack = {
  trackId: 'thousand_genomes_sv',
  name: 'Structural variants',
  category: ['Variants'],
  assemblyNames: ['hg38'],
  uri: 'https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20210124.SV_Illumina_Integration/1KGP_3202.gatksv_svtools_novelins.freeze_V3.wAF.vcf.gz',
  displayDefaults: { height: 90 },
}

function listTracks(session: Session) {
  return session.tracks.map(conf => {
    const trackId: string = readConfObject(conf, 'trackId')
    const [category = 'Uncategorized'] = (readConfObject(conf, 'category') ??
      []) as string[]
    return {
      trackId,
      category,
      name: (readConfObject(conf, 'name') as string) || trackId,
    }
  })
}

const TrackSelector = observer(function TrackSelector({
  session,
}: {
  session: Session
}) {
  const [filter, setFilter] = useState('')
  const { view } = session
  const needle = filter.trim().toLowerCase()
  const groups = Map.groupBy(
    listTracks(session).filter(e =>
      `${e.name} ${e.category}`.toLowerCase().includes(needle),
    ),
    e => e.category,
  )
  return (
    <div
      style={{
        width: 220,
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        fontSize: '0.8rem',
      }}
    >
      <input
        aria-label="Filter tracks"
        placeholder="Filter tracks"
        value={filter}
        onChange={event => {
          setFilter(event.target.value)
        }}
      />
      {[...groups].map(([category, entries]) => (
        <div key={category}>
          <strong>{category}</strong>
          {entries.map(({ trackId, name }) => (
            <TrackToggle
              key={trackId}
              view={view}
              trackId={trackId}
              style={{ display: 'block' }}
            >
              {name}
            </TrackToggle>
          ))}
        </div>
      ))}
      <button
        type="button"
        disabled={!!session.getTrackById(variantTrack.trackId)}
        style={{ marginTop: 'auto' }}
        onClick={() => {
          session.addSessionTrackConf(variantTrack)
        }}
      >
        Add a variant track
      </button>
    </div>
  )
})

const TrackSelectorSidebar = observer(function TrackSelectorSidebar() {
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
      {
        trackId: 'hg38_phylop',
        name: 'phyloP conservation',
        category: ['Signal'],
        uri: 'https://jbrowse.org/demos/phylop/hg38.phyloP100way.brca1.bw',
        displayDefaults: { height: 80, color: '#3a7ca5' },
      },
      {
        trackId: 'hg38_gnomad_genome_coverage',
        name: 'gnomAD genome coverage',
        category: ['Signal'],
        uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/gnomAD/coverage/v3-genome/gnomad.coverage.mean.bw',
        displayDefaults: { height: 80 },
      },
      {
        trackId: 'hg38_gnomad_exome_coverage',
        name: 'gnomAD exome coverage',
        category: ['Signal'],
        uri: 'https://hgdownload.soe.ucsc.edu/gbdb/hg38/gnomAD/coverage/v4-exome/gnomad.coverage.mean.bw',
        displayDefaults: { height: 80 },
      },
      {
        trackId: 'hg38_genes',
        name: 'RefSeq curated genes',
        category: ['Annotation'],
        uri: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz',
        index: 'https://jbrowse.org/ucsc/hg38/ncbiRefSeqCurated.gff.gz.csi',
        displayDefaults: { height: 120 },
      },
      {
        trackId: 'hg38_segmental_dups',
        name: 'Segmental duplications',
        category: ['Annotation'],
        uri: 'https://jbrowse.org/ucsc/hg38/genomicSuperDups.bed.gz',
        index: 'https://jbrowse.org/ucsc/hg38/genomicSuperDups.bed.gz.csi',
        displayDefaults: { height: 100 },
      },
      {
        trackId: 'na12878_exome',
        name: 'NA12878 exome reads',
        category: ['Alignments'],
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/alignments/NA12878/NA12878.alt_bwamem_GRCh38DH.20150826.CEU.exome.cram',
        displayDefaults: { height: 150 },
      },
      {
        trackId: 'thousand_genomes_snvindels',
        name: '1000 Genomes variants',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/variants/ALL.wgs.shapeit2_integrated_snvindels_v2a.GRCh38.27022019.sites.vcf.gz',
        displayDefaults: { height: 80 },
      },
    ],
    init: {
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
      <div style={{ display: 'flex', minHeight: 330 }}>
        <TrackSelector session={session} />
        <TrackStack
          view={session.view}
          trackIds={listTracks(session).map(e => e.trackId)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    </EmbedProvider>
  )
})

export default TrackSelectorSidebar
