import { useRef, useState } from 'react'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackCategory from './TrackCategory'
import TrackLabel from './TrackLabel'
import { type HierarchicalTrackSelectorModel, getItemHeight } from '../../model'

import type { TreeNode } from '../../types'

const levelWidth = 10

const useStyles = makeStyles()(theme => ({
  nestingLevelMarker: {
    position: 'absolute',
    borderLeft: '1.5px solid #555',
  },
  // accordionColor set's display:flex so that the child accordionText use
  // vertically centered text
  accordionColor: {
    background: theme.palette.tertiary.main,
    color: theme.palette.tertiary.contrastText,
    width: '100%',
    display: 'flex',
    paddingLeft: 5,
  },
}))

function getLeft(item: TreeNode) {
  return (
    item.nestingLevel * levelWidth + (!item.children.length ? levelWidth : 0)
  )
}

const TreeItem = observer(function ({
  item,
  model,
  itemOffset,
}: {
  item: TreeNode
  model: HierarchicalTrackSelectorModel
  itemOffset: number
}) {
  const { classes } = useStyles()
  const hasChildren = item.children.length > 0
  const top = itemOffset
  const { nestingLevel } = item

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        display: 'flex',
        cursor: 'pointer',
        height: getItemHeight(item),
        top,
        left: 0,
      }}
    >
      <div>
        {new Array(nestingLevel).fill(0).map((_, idx) => (
          <div
            /* biome-ignore lint/suspicious/noArrayIndexKey: */
            key={`mark-${idx}`}
            style={{ left: idx * levelWidth + 2, height: 100 }}
            className={classes.nestingLevelMarker}
          />
        ))}
        <div
          style={{
            whiteSpace: 'nowrap',
            width: '100%',
            position: 'absolute',
            left: getLeft(item),
            marginBottom: 2,
          }}
          className={hasChildren ? classes.accordionColor : undefined}
        >
          {item.type !== 'category' ? (
            <TrackLabel model={model} item={item} />
          ) : (
            <TrackCategory model={model} item={item} />
          )}
        </div>
      </div>
    </div>
  )
})

const TreeView = observer(function ({
  height,
  model,
}: {
  height: number
  model: HierarchicalTrackSelectorModel
}) {
  const { flattenedItems } = model
  const parentRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const { startIndex, endIndex, totalHeight, itemOffsets } = model.itemOffsets(
    height,
    scrollTop,
  )

  return (
    <div
      style={{
        overflow: 'hidden',
        marginLeft: 2,
      }}
    >
      <div
        ref={parentRef}
        style={{
          height,
          overflowY: 'auto',
          contain: 'strict',
        }}
        onScroll={e => {
          setScrollTop((e.target as HTMLUnknownElement).scrollTop)
        }}
      >
        <div
          style={{
            height: totalHeight,
            width: '100%',
            position: 'relative',
          }}
        >
          {Array.from({ length: endIndex - startIndex + 1 }, (_, i) => {
            const index = startIndex + i
            const item = flattenedItems[index]
            return item ? (
              <TreeItem
                model={model}
                key={item.id}
                item={item}
                itemOffset={itemOffsets[index]!}
              />
            ) : null
          })}
        </div>
      </div>
    </div>
  )
})

export default TreeView
