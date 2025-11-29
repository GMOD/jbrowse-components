import { useRef, useState } from 'react'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import TrackCategory from './TrackCategory'
import TrackLabel from './TrackLabel'

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
  rowHeight,
}: {
  item: TreeNode
  model: HierarchicalTrackSelectorModel
  itemOffset: number
  rowHeight: number
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
        height: rowHeight,
        top,
        left: 0,
      }}
    >
      <div style={{ display: 'flex', width: '100%' }}>
        {new Array(nestingLevel).fill(0).map((_, idx) => (
          <div
            /* biome-ignore lint/suspicious/noArrayIndexKey: */
            key={`mark-${idx}`}
            style={{ left: idx * levelWidth + 4, height: rowHeight }}
            className={classes.nestingLevelMarker}
          />
        ))}
        <div
          className={hasChildren ? classes.accordionCard : undefined}
          style={{
            marginLeft: getLeft(item),
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          <div className={hasChildren ? classes.accordionColor : undefined}>
            {item.type !== 'category' ? (
              <TrackLabel model={model} item={item} />
            ) : (
              <TrackCategory model={model} item={item} />
            )}
          </div>
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
            const nextOffset = itemOffsets[index + 1] ?? totalHeight
            const rowHeight = nextOffset - itemOffsets[index]!
            return item ? (
              <TreeItem
                model={model}
                key={item.id}
                item={item}
                itemOffset={itemOffsets[index]!}
                rowHeight={rowHeight}
              />
            ) : null
          })}
        </div>
      </div>
    </div>
  )
})

export default TreeView
