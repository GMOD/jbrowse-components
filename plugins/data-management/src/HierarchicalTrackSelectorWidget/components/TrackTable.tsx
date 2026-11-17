import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import FacetedDataGrid from '../../FacetedSelector/components/FacetedDataGrid.tsx'
import { getFacetedColumns } from '../../FacetedSelector/components/getFacetedColumns.tsx'
import {
  shownFields,
  tableMenuItems,
} from '../../FacetedSelector/components/tableLayout.ts'
import HierarchicalHeader from './tree/HierarchicalHeader.tsx'

import type { FacetedModel } from '../../FacetedSelector/facetedModel.ts'
import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  body: {
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(0, 1, 1, 0.5),
  },
}))

const TrackTable = observer(function TrackTable({
  model,
  table,
}: {
  model: HierarchicalTrackSelectorModel
  table: FacetedModel
}) {
  const { classes } = useStyles()
  const [ref, { width }] = useMeasure('width')
  const shown = width ? shownFields(table, width) : ['name']
  return (
    <>
      <HierarchicalHeader
        model={model}
        table={{
          menuItems: () => tableMenuItems(table, shown),
          matchCounts: table.matchCounts,
        }}
      />
      <div ref={ref} className={classes.body}>
        {width ? (
          <FacetedDataGrid
            model={model}
            faceted={table}
            columns={getFacetedColumns({
              faceted: table,
              model,
              fields: shown,
            })}
            width={width}
          />
        ) : null}
      </div>
    </>
  )
})

export default TrackTable
