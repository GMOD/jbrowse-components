import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import HierarchicalFab from './HierarchicalFab.tsx'
import TrackTable from './TrackTable.tsx'
import TreeTableToggle from './TreeTableToggle.tsx'
import HierarchicalHeader from './tree/HierarchicalHeader.tsx'
import HierarchicalTree from './tree/HierarchicalTree.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  treeContainer: {
    flex: 1,
    minHeight: 0,
  },
})

const TrackTree = observer(function TrackTree({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const [ref, { height }] = useMeasure('height')
  return (
    <>
      <HierarchicalHeader model={model} />
      <div ref={ref} className={classes.treeContainer}>
        {height ? <HierarchicalTree height={height} model={model} /> : null}
      </div>
      <HierarchicalFab model={model} />
    </>
  )
})

const HierarchicalTrackSelector = observer(function HierarchicalTrackSelector({
  model,
  toolbarHeight = 0,
}: {
  model: HierarchicalTrackSelectorModel
  toolbarHeight?: number
}) {
  const { classes } = useStyles()
  return (
    <div
      className={classes.container}
      style={{ height: `calc(100% - ${toolbarHeight}px)` }}
    >
      <TreeTableToggle model={model} />
      {model.showTable ? (
        <TrackTable model={model} />
      ) : (
        <TrackTree model={model} />
      )}
    </div>
  )
})

export default HierarchicalTrackSelector
