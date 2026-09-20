import { EmbedProvider, Legend, TrackStack } from '@jbrowse/display-ui/embed'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearBasicDisplayModel } from '@jbrowse/plugin-canvas'

const fields = ['gene_biotype', 'strand', 'source']

const domains: Record<string, string[]> = {
  gene_biotype: ['protein_coding', 'lncRNA', 'pseudogene'],
}

function FieldSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value?: string
  onChange: (field?: string) => void
}) {
  return (
    <label>
      {label}{' '}
      <select
        value={value ?? ''}
        onChange={event => {
          onChange(event.target.value || undefined)
        }}
      >
        <option value="">nothing</option>
        {fields.map(field => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
    </label>
  )
}

const Channels = observer(function Channels({
  display,
}: {
  display: LinearBasicDisplayModel
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        paddingBottom: 8,
        fontSize: '0.85rem',
      }}
    >
      <FieldSelect
        label="Color by"
        value={display.colorEncoding?.field}
        onChange={field => {
          display.setColorScale(
            field ? { field, domain: domains[field] } : undefined,
          )
        }}
      />
      <FieldSelect
        label="Group rows by"
        value={display.facet?.field}
        onChange={field => {
          display.setFacet(
            field ? { field, domain: domains[field] } : undefined,
          )
        }}
      />
      <Legend display={display} />
    </div>
  )
})

const ColorAndGroupByAField = observer(function ColorAndGroupByAField() {
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
        trackId: 'genes',
        name: 'NCBI RefSeq genes',
        uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        displayDefaults: {
          height: 220,
          geneGlyphMode: 'longestCoding',
          color: { field: 'gene_biotype', domain: domains.gene_biotype },
          showLegend: false,
        },
      },
    ],
    init: {
      loc: 'chr17:42,900,000..43,400,000',
      tracks: ['genes'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  const display = session.view.getTrack('genes')?.activeDisplay as
    | LinearBasicDisplayModel
    | undefined
  return (
    <EmbedProvider session={session}>
      {display ? <Channels display={display} /> : null}
      <TrackStack view={session.view} />
    </EmbedProvider>
  )
})

export default ColorAndGroupByAField
