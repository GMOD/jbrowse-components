import { ResizeHandle } from '@jbrowse/core/ui'
import SanitizedHTML from '@jbrowse/core/ui/SanitizedHTML'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetFilters from './FacetFilters.tsx'
import FacetedDataGrid from './FacetedDataGrid.tsx'
import FacetedHeader from './FacetedHeader.tsx'
import TrackSelectorTrackMenu from '../../HierarchicalTrackSelectorWidget/components/tree/TrackSelectorTrackMenu.tsx'

import type { FacetedColumn } from './FacetedDataGrid.tsx'
import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

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
  faceted,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const { selection, shownTrackIds } = model
  const {
    rows,
    panelWidth,
    showFilters,
    filterText,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
  } = faceted

  const nonMetadataFieldSet = new Set(['name', ...filteredNonMetadataKeys])

  const columns: FacetedColumn[] = [
    {
      id: 'name',
      header: 'name',
      cell: row => (
        <div className={classes.cell}>
          <HighlightText text={row.name} query={filterText} />
          <TrackSelectorTrackMenu id={row.id} conf={row.conf} model={model} />
        </div>
      ),
    },
    ...filteredNonMetadataKeys.map(
      e =>
        ({
          id: e,
          header: e,
          cell: row => {
            const val =
              e === 'category'
                ? row.category
                : e === 'adapter'
                  ? row.adapter
                  : e === 'description'
                    ? row.description
                    : ''
            return (
              <HighlightCell
                value={`${val ?? ''}`}
                filterText={filterText}
                className={classes.cell}
              />
            )
          },
        }) satisfies FacetedColumn,
    ),
    ...filteredMetadataKeys.map(
      e =>
        ({
          id: `metadata.${e}`,
          header: nonMetadataFieldSet.has(e) ? `${e} (from metadata)` : e,
          cell: row => (
            <HighlightCell
              value={`${row.metadata[e] ?? ''}`}
              filterText={filterText}
              className={classes.cell}
            />
          ),
        }) satisfies FacetedColumn,
    ),
  ]

  const facetColumns = columns.map(col => ({ field: col.id }))

  return (
    <>
      <FacetedHeader model={model} faceted={faceted} />
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
            faceted={faceted}
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
              <FacetFilters
                faceted={faceted}
                rows={rows}
                columns={facetColumns}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
