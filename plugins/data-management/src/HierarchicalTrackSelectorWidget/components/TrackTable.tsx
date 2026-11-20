import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import TrackTableGrid from '../../TrackTable/components/TrackTableGrid.tsx'
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
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const table = model.trackTable
  const [ref, { width }] = useMeasure('width')
  const shown = width ? shownFields(table, width) : ['name']
  return (
    <>
      <HierarchicalHeader
        model={model}
        tableMenuItems={() => tableMenuItems(model, table, shown)}
      />
      <div ref={ref} className={classes.body}>
        {width ? (
          <TrackTableGrid
            model={model}
            table={table}
            fields={shown}
            width={width}
            emptyMessage={model.emptyListMessage}
          />
        ) : null}
      </div>
    </>
  )
})

export default TrackTable
