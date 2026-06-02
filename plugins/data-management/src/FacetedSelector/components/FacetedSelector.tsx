import { useSyncExternalStore } from 'react'

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
  container: {
    display: 'flex',
    overflow: 'hidden',
  },
  dataPane: {
    overflow: 'hidden',
  },
  filterPane: {
    overflow: 'auto',
  },
})

const frac = 0.75

const subscribeToResize = (cb: () => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

const FacetedSelector = observer(function FacetedSelector({
  model,
  faceted,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const windowWidth = useSyncExternalStore(
    subscribeToResize,
    () => window.innerWidth,
  )
  const windowHeight = useSyncExternalStore(
    subscribeToResize,
    () => window.innerHeight,
  )
  const { selection, shownTrackIds } = model
  const {
    panelWidth,
    showFilters,
    filteredNonMetadataKeys,
    filteredMetadataKeys,
    nonMetadataFieldSet,
  } = faceted

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

  const h = windowHeight * frac
  const w = windowWidth * frac

  return (
    <>
      <FacetedHeader model={model} faceted={faceted} />
      <div className={classes.container} style={{ height: h, width: w }}>
        <div
          className={classes.dataPane}
          style={{ height: h, width: w - (showFilters ? panelWidth : 0) }}
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
            <div className={classes.filterPane} style={{ width: panelWidth }}>
              <FacetFilters faceted={faceted} />
            </div>
          </>
        ) : null}
      </div>
    </>
  )
})

export default FacetedSelector
