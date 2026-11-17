import { ResizeHandle } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetFilters from './FacetFilters.tsx'
import FacetedDataGrid from './FacetedDataGrid.tsx'
import FacetedHeader from './FacetedHeader.tsx'
import { getFacetedColumns } from './getFacetedColumns.tsx'
import { useWindowSize } from './useWindowSize.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

const useStyles = makeStyles()({
  resizeHandle: {
    marginLeft: 5,
    width: 5,
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  container: {
    display: 'flex',
    overflow: 'hidden',
  },
  dataPane: {
    height: '100%',
    overflow: 'hidden',
  },
  filterPane: {
    overflow: 'auto',
  },
})

const frac = 0.75

const FacetedSelector = observer(function FacetedSelector({
  model,
  faceted,
  size,
  onFilterTextChange,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
  size?: { width: number; height: number }
  onFilterTextChange?: (value: string) => void
}) {
  const { classes } = useStyles()
  const { width, height } = useWindowSize()
  const { selectionSet, shownTrackIds } = model
  const { showFilters } = faceted

  const columns = getFacetedColumns({ faceted, model })

  const w = size?.width ?? width * frac
  // the filter pane never takes more than half, so a width saved in a wider
  // window still leaves the grid room
  const panelWidth = Math.max(0, Math.min(faceted.panelWidth, w / 2))

  return (
    <div
      className={classes.root}
      style={size ? { width: w, height: size.height } : undefined}
    >
      <FacetedHeader
        model={model}
        faceted={faceted}
        columns={columns}
        onFilterTextChange={onFilterTextChange}
      />
      <div
        className={classes.container}
        style={
          size
            ? { width: w, flex: 1, minHeight: 0 }
            : { width: w, height: height * frac }
        }
      >
        <div
          className={classes.dataPane}
          style={{ width: w - (showFilters ? panelWidth : 0) }}
        >
          <FacetedDataGrid
            model={model}
            faceted={faceted}
            columns={columns}
            shownTrackIds={shownTrackIds}
            selectionSet={selectionSet}
            width={w - (showFilters ? panelWidth : 0)}
          />
        </div>

        {showFilters ? (
          <>
            <ResizeHandle
              vertical
              value={panelWidth}
              reverse
              onChange={width => {
                faceted.setPanelWidth(width)
              }}
              className={classes.resizeHandle}
            />
            <div className={classes.filterPane} style={{ width: panelWidth }}>
              <FacetFilters faceted={faceted} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
})

export default FacetedSelector
