import { useMemo, useRef, useState } from 'react'

import { makeStyles } from 'tss-react/mui'

import TrackCategory from './TrackCategory'
import TrackLabel from './TrackLabel'

import type { TreeNode } from '../../types'
import type { HierarchicalTrackSelectorModel } from '../../model'
import { observer } from 'mobx-react'

const defaultItemHeight = 20
const categoryItemHeight = 32
const width = 10
const overscan = 5

// Function to determine the height of an item based on its type
function getItemHeight(item: TreeNode) {
  return item.type === 'category' ? categoryItemHeight : defaultItemHeight
}

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

function getLeft(item: TreeNode) {
  return item.nestingLevel * width + 10
}

const TreeItem = observer(function ({
  item,
  index,
  model,
  itemOffsets,
}: {
  item: TreeNode
  index: number
  model: HierarchicalTrackSelectorModel
  itemOffsets: number[]
}) {
  const { classes } = useStyles()
  const hasChildren = item.children.length > 0
  const top = itemOffsets[index]
  const { nestingLevel } = item
  const isLeaf = !hasChildren
  const currentItemHeight = getItemHeight(item)

  return (
    <div
      style={{
        position: 'absolute',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        height: currentItemHeight,
        top,
        left: 0,
      }}
      onClick={() => {
        if (hasChildren) {
          model.toggleCategory(item.id)
        }
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: getLeft(item),
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

  // Calculate visible range with variable height items
  const { startIndex, endIndex, totalHeight, itemOffsets } = useMemo(() => {
    // Calculate the cumulative height offsets for each item
    const offsets: number[] = []
    let cumulativeHeight = 0

    flattenedItems.forEach(item => {
      offsets.push(cumulativeHeight)
      cumulativeHeight += getItemHeight(item)
    })

    // Binary search to find the start index based on scroll position
    const findIndexAtOffset = (offset: number) => {
      let low = 0
      let high = offsets.length - 1

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        if (
          offsets[mid] <= offset &&
          (mid === offsets.length - 1 || offsets[mid + 1] > offset)
        ) {
          return mid
        } else if (offsets[mid] < offset) {
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      return 0
    }

    // Find the approximate start index
    const start = Math.max(0, findIndexAtOffset(scrollTop) - overscan)

    // Estimate the end index (this is an approximation)
    let end = start
    let currentHeight = offsets[start]
    const targetHeight =
      scrollTop +
      height +
      overscan * Math.min(categoryItemHeight, defaultItemHeight)

    while (end < flattenedItems.length - 1 && currentHeight < targetHeight) {
      end++
      currentHeight = offsets[end] + getItemHeight(flattenedItems[end])
    }

    return {
      startIndex: start,
      endIndex: end,
      totalHeight: cumulativeHeight,
      itemOffsets: offsets,
    }
  }, [scrollTop, height, flattenedItems])

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
            return item ? (
              <TreeItem
                model={model}
                key={item.id}
                item={item}
                index={index}
                itemOffsets={itemOffsets}
              />
            ) : null
          })}
        </div>
      </div>
    </div>
  )
})

export default TreeView
