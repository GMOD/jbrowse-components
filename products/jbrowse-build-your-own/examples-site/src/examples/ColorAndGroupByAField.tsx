import {
  EmbedProvider,
  Legend,
  Toolbar,
  TrackStack,
} from '@jbrowse/display-ui/embed'
import { isLinearBasicDisplay } from '@jbrowse/plugin-canvas'
import { useCreateViewState } from '@jbrowse/react-linear-genome-view2'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/react-linear-genome-view2'

const fields = ['gene_biotype', 'strand', 'source']

const domains: Record<string, string[]> = {
  gene_biotype: ['protein_coding', 'lncRNA', 'pseudogene'],
}

const FieldSelect = observer(function FieldSelect({
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
})

const Channels = observer(function Channels({
  view,
}: {
  view: LinearGenomeViewModel
}) {
  const display = view.getTrack('genes')?.activeDisplay
  if (!isLinearBasicDisplay(display)) {
    return null
  }
  return (
    <Toolbar>
      <FieldSelect
        label="Color by"
        value={display.colorField}
        onChange={field => {
          display.applyPlot({
            encoding: {
              color: field
                ? { field, scale: { domain: domains[field] } }
                : null,
            },
          })
        }}
      />
      <FieldSelect
        label="Group rows by"
        value={display.facet?.field}
        onChange={field => {
          display.applyPlot({
            facet: field ? { field, sort: domains[field] } : null,
          })
        }}
      />
      <Legend view={view} trackId="genes" />
    </Toolbar>
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
    },
    tracks: [
      {
        trackId: 'genes',
        name: 'NCBI RefSeq genes',
        uri: 'https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz',
        displayDefaults: {
          height: 220,
          geneGlyphMode: 'representative',
          encoding: {
            color: {
              field: 'gene_biotype',
              scale: { domain: domains.gene_biotype },
            },
          },
          legend: { show: false },
        },
      },
    ],
    view: {
      loc: 'chr17:42,900,000..43,400,000',
      tracks: ['genes'],
    },
  })
  if (!state) {
    return null
  }
  const { session } = state
  return (
    <EmbedProvider session={session}>
      <Channels view={session.view} />
      <TrackStack view={session.view} />
    </EmbedProvider>
  )
})

export default ColorAndGroupByAField
