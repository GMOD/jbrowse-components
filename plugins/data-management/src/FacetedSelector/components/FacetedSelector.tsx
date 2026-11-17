import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import FacetChips from './FacetChips.tsx'
import FacetedDataGrid from './FacetedDataGrid.tsx'
import FacetedHeader from './FacetedHeader.tsx'
import { getFacetedColumns } from './getFacetedColumns.tsx'
import { shownFields } from './tableLayout.ts'
import { useWindowSize } from './useWindowSize.ts'

import type { HierarchicalTrackSelectorModel } from '../../HierarchicalTrackSelectorWidget/model.ts'
import type { FacetedModel } from '../facetedModel.ts'

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  grid: {
    flex: 1,
    minHeight: 0,
  },
})

const frac = 0.75

/**
 * a table with its own filter box, for a dialog sized to the window
 */
const FacetedSelector = observer(function FacetedSelector({
  model,
  faceted,
}: {
  model: HierarchicalTrackSelectorModel
  faceted: FacetedModel
}) {
  const { classes } = useStyles()
  const windowSize = useWindowSize()
  const width = windowSize.width * frac
  const shown = shownFields(faceted, width)
  return (
    <div
      className={classes.root}
      style={{ width, height: windowSize.height * frac }}
    >
      <FacetedHeader model={model} faceted={faceted} shown={shown} />
      <FacetChips faceted={faceted} />
      <div className={classes.grid}>
        <FacetedDataGrid
          model={model}
          faceted={faceted}
          columns={getFacetedColumns({ faceted, model, fields: shown })}
          width={width}
        />
      </div>
    </div>
  )
})

export default FacetedSelector
