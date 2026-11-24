import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import TrackTableGrid from '../../TrackTable/components/TrackTableGrid.tsx'
import {
  shownFields,
  tableMenuItems,
} from '../../TrackTable/components/tableLayout.ts'
import { noMatchingTracksMessage } from '../../TrackTable/components/util.ts'
import HierarchicalHeader from './tree/HierarchicalHeader.tsx'
import HierarchicalTree from './tree/HierarchicalTree.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  tableBody: {
    padding: theme.spacing(0, 1, 1, 0.5),
  },
  empty: {
    margin: theme.spacing(1, 2),
  },
  emptyInGroup: {
    marginLeft: theme.spacing(3.5),
  },
}))

// a Favorites or Recent group row stays over its empty list, with the line
// that says so inside it
const TrackTree = observer(function TrackTree({
  model,
  height,
}: {
  model: HierarchicalTrackSelectorModel
  height: number
}) {
  const { classes, cx } = useStyles()
  const { rows, trackList, hierarchy, treeHeight } = model
  const empty =
    rows.length === 0 ||
    (trackList !== 'all' && hierarchy.children[0]?.children.length === 0)
  const message = empty
    ? model.trackTable.allRows.length > 0
      ? noMatchingTracksMessage
      : model.emptyListMessage
    : undefined
  return (
    <>
      {rows.length > 0 ? (
        <HierarchicalTree
          height={message ? Math.min(treeHeight, height) : height}
          model={model}
        />
      ) : null}
      {message ? (
        <Typography
          variant="body2"
          color="textSecondary"
          className={cx(classes.empty, rows.length > 0 && classes.emptyInGroup)}
        >
          {message}
        </Typography>
      ) : null}
    </>
  )
})

/**
 * One header over both modes, so the filter box and the Tree | Table toggle
 * keep their focus across a switch; the body below is measured once for
 * either the tree's height or the table's width. Slid out wide, the table
 * shows every column at its measured width and scrolls sideways
 */
const HierarchicalTrackSelector = observer(function HierarchicalTrackSelector({
  model,
  toolbarHeight = 0,
}: {
  model: HierarchicalTrackSelectorModel
  toolbarHeight?: number
}) {
  const { classes, cx } = useStyles()
  const [ref, { width, height }] = useMeasure()
  const { showTable, trackTable } = model
  const wide = model.tableWide
  const fields = wide
    ? trackTable.wideColumns
    : width
      ? shownFields(trackTable, width)
      : ['name']
  return (
    <div
      className={classes.container}
      style={{ height: `calc(100% - ${toolbarHeight}px)` }}
    >
      <HierarchicalHeader
        model={model}
        tableMenuItems={
          showTable
            ? () => tableMenuItems(model, trackTable, fields)
            : undefined
        }
      />
      <div
        ref={ref}
        className={cx(classes.body, showTable && classes.tableBody)}
      >
        {showTable ? (
          width ? (
            <TrackTableGrid
              model={model}
              table={trackTable}
              fields={fields}
              width={width}
              emptyMessage={model.emptyListMessage}
              naturalWidths={wide}
            />
          ) : null
        ) : height ? (
          <TrackTree model={model} height={height} />
        ) : null}
      </div>
    </div>
  )
})

export default HierarchicalTrackSelector
