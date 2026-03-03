import { ResizeHandle } from '@jbrowse/core/ui'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetFilters from './FacetFilters.tsx'
import FacetedDataGrid from './FacetedDataGrid.tsx'
import FacetedHeader from './FacetedHeader.tsx'
import TrackSelectorTrackMenu from '../tree/TrackSelectorTrackMenu.tsx'

import type { FacetedRow } from '../../facetedModel.ts'
import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid'

type T = GridColDef<FacetedRow>

const useStyles = makeStyles()({
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  resizeHandle: {
    marginLeft: 5,
    background: 'grey',
    width: 5,
  },
})

function HighlightText({
  text,
  query,
  className,
}: {
  text: string
  query: string
  className?: string
}) {
  if (!query || !text) {
    return <SanitizedHTML html={text} className={className} />
  }
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let idx = lowerText.indexOf(lowerQuery, lastIndex)
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx))
    }
    parts.push(
      <mark key={idx} style={{ background: '#FFEB3B' }}>
        {text.slice(idx, idx + query.length)}
      </mark>,
    )
    lastIndex = idx + query.length
    idx = lowerText.indexOf(lowerQuery, lastIndex)
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return <span className={className}>{parts}</span>
}

const frac = 0.75

function HighlightCell({
  value,
  filterText,
  className,
}: {
  value: string | undefined
  filterText: string
  className: string
}) {
  return value ? (
    <HighlightText className={className} text={value} query={filterText} />
  ) : (
    ''
  )
}

const FacetedSelector = observer(function FacetedSelector({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const { selection, shownTrackIds, faceted } = model
  const {
    rows,
    panelWidth,
    showFilters,
    filterText,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
  } = faceted

  const nonMetadataFieldSet = new Set(['name', ...filteredNonMetadataKeys])

  const columns: T[] = [
    {
      field: 'name',
      hideable: false,
      renderCell: params => {
        const { value, row } = params
        const { id, conf } = row
        return (
          <div className={classes.cell}>
            <HighlightText text={value as string} query={filterText} />
            <TrackSelectorTrackMenu id={id} conf={conf} model={model} />
          </div>
        )
      },
    },
    ...filteredNonMetadataKeys.map(e => {
      return {
        field: e,
        renderCell: (params: GridRenderCellParams<FacetedRow>) => (
          <HighlightCell
            value={params.value}
            filterText={filterText}
            className={classes.cell}
          />
        ),
      } satisfies T
    }),
    ...filteredMetadataKeys.map(e => {
      return {
        field: `metadata.${e}`,
        headerName: nonMetadataFieldSet.has(e) ? `${e} (from metadata)` : e,
        valueGetter: (_, row) => `${row.metadata[e] ?? ''}`,
        renderCell: (params: GridRenderCellParams<FacetedRow>) => (
          <HighlightCell
            value={params.value}
            filterText={filterText}
            className={classes.cell}
          />
        ),
      } satisfies T
    }),
  ]

  return (
    <>
      <FacetedHeader model={model} />
      <div
        style={{
          display: 'flex',
          overflow: 'hidden',
          height: window.innerHeight * frac,
          width: window.innerWidth * frac,
        }}
      >
        <div
          style={{
            height: window.innerHeight * frac,
            width: window.innerWidth * frac - (showFilters ? panelWidth : 0),
          }}
        >
          <FacetedDataGrid
            model={model}
            columns={columns}
            shownTrackIds={shownTrackIds}
            selection={selection}
          />
        </div>

        {showFilters ? (
          <>
            <ResizeHandle
              vertical
              onDrag={dist => faceted.setPanelWidth(panelWidth - dist)}
              className={classes.resizeHandle}
            />
            <div style={{ width: panelWidth, overflow: 'auto' }}>
              <FacetFilters model={model} rows={rows} columns={columns} />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
