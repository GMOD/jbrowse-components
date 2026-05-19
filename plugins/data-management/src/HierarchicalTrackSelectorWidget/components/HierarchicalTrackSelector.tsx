import { makeStyles } from '@jbrowse/core/util/tss-react'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { observer } from 'mobx-react'

import HierarchicalFab from './HierarchicalFab.tsx'
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

const HierarchicalTrackSelectorContainer = observer(
  function HierarchicalTrackSelectorContainer({
    model,
    toolbarHeight,
    overrideDimensions,
  }: {
    model: HierarchicalTrackSelectorModel
    toolbarHeight: number
    overrideDimensions?: { width: number; height: number }
  }) {
    const inner = (
      <>
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
        />
        <HierarchicalFab model={model} />
      </>
    )
    return overrideDimensions ? (
      <div style={{ ...overrideDimensions }}>{inner}</div>
    ) : (
      inner
    )
  },
)

const HierarchicalTrackSelector = observer(function HierarchicalTrackSelector({
  model,
  toolbarHeight = 0,
}: {
  model: HierarchicalTrackSelectorModel
  toolbarHeight?: number
}) {
  const { classes } = useStyles()
  const [ref, { height }] = useMeasure()
  return (
    <div
      className={classes.container}
      style={{ height: `calc(100% - ${toolbarHeight}px)` }}
    >
      <HierarchicalHeader model={model} />
      <div ref={ref} className={classes.treeContainer}>
        {height ? <HierarchicalTree height={height} model={model} /> : null}
      </div>
    </div>
  )
})

export default HierarchicalTrackSelectorContainer
