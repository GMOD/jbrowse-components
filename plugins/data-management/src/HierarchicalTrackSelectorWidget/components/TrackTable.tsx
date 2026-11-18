import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import TrackTableGrid from '../../TrackTable/components/TrackTableGrid.tsx'
import { getTableColumns } from '../../TrackTable/components/getTableColumns.tsx'
import {
  shownFields,
  tableMenuItems,
} from '../../TrackTable/components/tableLayout.ts'
import HierarchicalHeader from './tree/HierarchicalHeader.tsx'

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
  emptyMessage,
}: {
  model: HierarchicalTrackSelectorModel
  emptyMessage?: string
}) {
  const { classes } = useStyles()
  const table = model.trackTable
  const [ref, { width }] = useMeasure('width')
  const shown = width ? shownFields(table, width) : ['name']
  return (
    <>
      <HierarchicalHeader
        model={model}
        tableMenuItems={() => tableMenuItems(table, shown)}
      />
      <div ref={ref} className={classes.body}>
        {width ? (
          <TrackTableGrid
            model={model}
            table={table}
            columns={getTableColumns({
              table,
              model,
              fields: shown,
            })}
            width={width}
            emptyMessage={emptyMessage}
          />
        ) : null}
      </div>
    </>
  )
})

export default TrackTable
