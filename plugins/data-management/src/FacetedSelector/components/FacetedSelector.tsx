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

const FacetedSelector = observer(function FacetedSelector({
  model,
  faceted,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const { width, height } = useWindowSize()
  const { selection, shownTrackIds } = model
  const { panelWidth, showFilters } = faceted

  const columns = getFacetedColumns({
    faceted,
    model,
    nameClassName: classes.cell,
  })

  const h = height * frac
  const w = width * frac

  return (
    <>
      <FacetedHeader model={model} faceted={faceted} columns={columns} />
      <div className={classes.container} style={{ height: h, width: w }}>
        <div
          className={classes.dataPane}
          style={{
            height: h,
            width: Math.max(0, w - (showFilters ? panelWidth : 0)),
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
              onDrag={dist => { faceted.setPanelWidth(panelWidth - dist) }}
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
