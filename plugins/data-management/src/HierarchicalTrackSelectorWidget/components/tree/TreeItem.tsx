import { memo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import TrackCategory from './TrackCategory'
import TrackLabel from './TrackLabel'
import { getItemHeight } from '../../model'

import type { HierarchicalTrackSelectorModel } from '../../model'
import type { TreeNode } from '../../types'

const levelWidth = 10

const useStyles = makeStyles()(theme => ({
  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: '1.5px solid #555',
  },
  accordionCard: {
    padding: 3,
    cursor: 'pointer',
    display: 'flex',
  },
  accordionColor: {
    background: theme.palette.tertiary.main,
    color: theme.palette.tertiary.contrastText,
    width: '100%',
    display: 'flex',
    paddingLeft: 5,
  },
}))

// Memoized to prevent re-renders when parent re-renders but props haven't changed
const TreeItem = memo(function TreeItem({
  item,
  model,
  top,
}: {
  item: TreeNode
  model: HierarchicalTrackSelectorModel
  top: number
}) {
  const { classes } = useStyles()
  const isCategory = item.type === 'category'
  const { nestingLevel } = item
  const height = getItemHeight(item)
  const marginLeft = nestingLevel * levelWidth + (isCategory ? 0 : levelWidth)

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        display: 'flex',
        cursor: 'pointer',
        height,
        top,
      }}
    >
      {new Array(nestingLevel).fill(0).map((_, idx) => (
        <div
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          key={`mark-${idx}`}
          style={{ left: idx * levelWidth + 4, height }}
          className={classes.nestingLevelMarker}
        />
      ))}
      <div
        className={isCategory ? classes.accordionCard : undefined}
        style={{
          marginLeft,
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        <div className={isCategory ? classes.accordionColor : undefined}>
          {isCategory ? (
            <TrackCategory model={model} item={item} />
          ) : (
            <TrackLabel model={model} item={item} />
          )}
        </div>
      </div>
    </div>
  )
})

export default TreeItem
