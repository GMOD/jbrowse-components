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
    width: 5,
  },
})

export function HighlightText({
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
  let highlighted = ''
  let lastIndex = 0
  let idx = lowerText.indexOf(lowerQuery, lastIndex)
  while (idx !== -1) {
    if (idx > lastIndex) {
      highlighted += text.slice(lastIndex, idx)
    }
    highlighted += `<mark style="background: #FFEB3B">${text.slice(
      idx,
      idx + query.length,
    )}</mark>`
    lastIndex = idx + query.length
    idx = lowerText.indexOf(lowerQuery, lastIndex)
  }
  if (lastIndex < text.length) {
    highlighted += text.slice(lastIndex)
  }
  return <SanitizedHTML html={highlighted} className={className} />
}

const frac = 0.75

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
          <SanitizedHTML html={row.name} />
          <TrackSelectorTrackMenu id={row.id} conf={row.conf} model={model} />
        </div>
      ),
    },
    ...filteredNonMetadataKeys.map(
      e =>
        ({
          id: e,
          header: e,
          cell: row => row[e as 'category' | 'adapter' | 'description'],
        }) satisfies FacetedColumn,
    ),
    ...filteredMetadataKeys.map(
      e =>
        ({
          id: `metadata.${e}`,
          header: nonMetadataFieldSet.has(e) ? `${e} (from metadata)` : e,
          cell: row => {
            const val = row.metadata[e]
            return val != null ? `${val}` : null
          },
        }) satisfies FacetedColumn,
    ),
  ]

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
                fields={columns.map(c => c.id)}
              />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
