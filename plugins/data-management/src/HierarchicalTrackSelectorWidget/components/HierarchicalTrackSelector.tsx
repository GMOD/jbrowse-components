import { observer } from 'mobx-react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import AutoSizer from './AutoSizer.tsx'
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

const Wrapper = ({
  overrideDimensions,
  children,
}: {
  overrideDimensions?: { width: number; height: number }
  children: React.ReactNode
}) =>
  overrideDimensions ? (
    <div style={{ ...overrideDimensions }}>{children}</div>
  ) : (
    children
  )

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
    return (
      <Wrapper overrideDimensions={overrideDimensions}>
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
        />
        <HierarchicalFab model={model} />
      </Wrapper>
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
  return (
    <div
      className={classes.container}
      style={{ height: `calc(100% - ${toolbarHeight}px)` }}
    >
      <HierarchicalHeader model={model} />
      <div className={classes.treeContainer}>
        <AutoSizer disableWidth>
          {args => <HierarchicalTree height={args.height} model={model} />}
        </AutoSizer>
      </div>
    </div>
  )
})

export default HierarchicalTrackSelectorContainer
