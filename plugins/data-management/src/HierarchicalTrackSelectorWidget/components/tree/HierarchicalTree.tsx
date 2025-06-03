import { useMemo, useRef, useState } from 'react'

import { makeStyles } from 'tss-react/mui'

import TrackCategory from './TrackCategory'
import TrackLabel from './TrackLabel'

import type { TreeNode } from '../../generateHierarchy'
import type { HierarchicalTrackSelectorModel } from '../../model'
import { observer } from 'mobx-react'

const itemHeight = 20
const width = 10
const overscan = 5

const useStyles = makeStyles()(theme => ({
  // this accordionBase element's small padding is used to give a margin to
  // accordionColor it a "margin" because the virtualized elements can't really
  // use margin in a conventional way (it doesn't affect layout)
  accordionBase: {
    display: 'flex',
  },

  accordionCard: {
    padding: 3,
    cursor: 'pointer',
    display: 'flex',
  },

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

function getPaddingLeft(item: TreeNode) {
  return item.nestingLevel * width
}

const TreeItem = observer(function ({
  item,
  index,
  model,
}: {
  item: TreeNode
  index: number
  model: HierarchicalTrackSelectorModel
}) {
  const { classes } = useStyles()
  const hasChildren = item.children.length > 0
  const top = index * itemHeight
  const { nestingLevel } = item

  console.log({ item })
  const isLeaf = !hasChildren

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        height: itemHeight,
        top,
        left: 0,
      }}
      onClick={() => hasChildren && model.toggleCategory(item.id)}
    >
      <div
        style={{
          marginLeft: getPaddingLeft(item),
          marginBottom: 2,
        }}
        className={hasChildren ? classes.accordionColor : undefined}
      >
        <div>
          {new Array(nestingLevel).fill(0).map((_, idx) => (
            <div
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              key={`mark-${idx}`}
              className={classes.nestingLevelMarker}
            />
          ))}
          <div
            style={{
              whiteSpace: 'nowrap',
              width: '100%',
            }}
          >
            <div className={!isLeaf ? classes.accordionColor : undefined}>
              {isLeaf ? (
                <TrackLabel model={model} item={item} />
              ) : (
                <TrackCategory model={model} item={item} />
              )}
            </div>
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

  // Calculate visible range
  const { startIndex, endIndex, totalHeight } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(height / itemHeight)
    const end = Math.min(
      flattenedItems.length - 1,
      start + visibleCount + overscan * 2,
    )

    return {
      startIndex: start,
      endIndex: end,
      totalHeight: flattenedItems.length * itemHeight,
    }
  }, [scrollTop, height, flattenedItems.length])

  return (
    <div style={{ maxWidth: '28rem', marginLeft: 'auto', marginRight: 'auto' }}>
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
              return item ? (
                <TreeItem
                  model={model}
                  key={item.id}
                  item={item}
                  index={index}
                />
              ) : null
            })}
          </div>
        </div>
      </div>
    </div>
  )
})

export default TreeView
