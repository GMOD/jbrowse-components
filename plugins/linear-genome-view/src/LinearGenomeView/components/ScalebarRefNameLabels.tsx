import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { getBlockRefName, showRefNameLabels } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

interface MenuState {
  anchorEl: HTMLElement
  refName: string
  displayedRegionIndex: number
}

const useStyles = makeStyles()(theme => ({
  refLabel: {
    fontSize: 11,
    position: 'absolute',
    // x-position is driven by transform:translateX (compositor-only) not left
    left: 0,
    top: -1,
    fontWeight: 'bold',
    lineHeight: 'normal',
    zIndex: 1,
    background: theme.palette.background.paper,
    cursor: 'pointer',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    '&:hover': {
      background: theme.palette.grey[300],
    },
  },
  b0: {
    zIndex: 100,
  },
}))

const ScalebarRefNameLabels = observer(function ScalebarRefNameLabels({
  model,
}: {
  model: LGV
}) {
  const { classes, cx } = useStyles()
  const [menuState, setMenuState] = useState<MenuState>()

  const { staticBlocks, offsetPx } = model
  const blocks = staticBlocks.blocks
  const prefix = model.scalebarDisplayPrefix()
  const regionEndPx = model.scalebarRegionEndPx

  // Sticky label: rightmost content block whose left edge is within/before the
  // viewport. Falls back to the first content block if none are left of viewport.
  let stickyBlockIdx = -1
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!
    if (
      b.type === 'ContentBlock' &&
      (stickyBlockIdx === -1 || b.offsetPx < offsetPx)
    ) {
      stickyBlockIdx = i
    }
  }

  const labels = []

  // Set once the sticky far-left label renders the prefix inline (e.g.
  // "hg38:chr5"); the standalone prefix below is then skipped to show it once.
  let stickyHasPrefix = false

  const showRefName = showRefNameLabels(blocks, getBlockRefName)

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.type !== 'ContentBlock') {
      continue
    }
    const sticky = i === stickyBlockIdx
    if ((!block.isLeftEndOfDisplayedRegion || !showRefName[i]) && !sticky) {
      continue
    }
    const layout = getLabelLayout(block, offsetPx, regionEndPx, sticky)
    if (!layout) {
      continue
    }
    const { transform, maxWidth } = layout
    const { refName, displayedRegionIndex } = block
    if (sticky && prefix) {
      stickyHasPrefix = true
    }
    labels.push(
      <span
        key={block.key}
        className={classes.refLabel}
        style={{
          transform: `translateX(${transform}px)`,
          paddingLeft: sticky ? 0 : 1,
          maxWidth,
        }}
        data-testid={`refLabel-${refName}`}
        onMouseDown={() => {
          model.setScalebarRefNameClickPending(true)
        }}
        onClick={e => {
          model.setScalebarRefNameClickPending(false)
          model.setIsScalebarRefNameMenuOpen(true)
          setMenuState({
            anchorEl: e.currentTarget,
            refName,
            displayedRegionIndex: displayedRegionIndex!,
          })
        }}
      >
        {sticky && prefix ? `${prefix}:${refName}` : refName}
      </span>,
    )
  }

  // Fallback: show the bare assembly name pinned far-left only when no sticky
  // region label carried it (e.g. the leftmost region was too narrow to label).
  if (prefix && !stickyHasPrefix) {
    labels.push(
      <span
        key="b0"
        className={cx(classes.b0, classes.refLabel)}
        data-testid="refLabel-prefix"
      >
        {prefix}
      </span>,
    )
  }

  return (
    <>
      <div>{labels}</div>
      {menuState ? (
        <RefNameMenu
          model={model}
          menuState={menuState}
          onClose={() => {
            model.setIsScalebarRefNameMenuOpen(false)
            setMenuState(undefined)
          }}
        />
      ) : null}
    </>
  )
})

// Returns the CSS translateX value and maxWidth for a ref-name label.
// Returns undefined when the label is too narrow to display (< 20px).
function getLabelLayout(
  block: ContentBlock,
  offsetPx: number,
  regionEndPx: Map<number, number>,
  sticky: boolean,
): { transform: number; maxWidth: number | undefined } | undefined {
  const regEndPxVal =
    block.displayedRegionIndex !== undefined
      ? regionEndPx.get(block.displayedRegionIndex)
      : undefined
  const labelStartPx = sticky ? offsetPx : block.offsetPx
  const maxWidth =
    regEndPxVal !== undefined ? regEndPxVal - labelStartPx - 2 : undefined
  if (maxWidth !== undefined && maxWidth < 20) {
    return undefined
  }
  const transform = sticky
    ? Math.max(0, -offsetPx)
    : block.offsetPx - offsetPx - 1
  return { transform, maxWidth }
}

const RefNameMenu = observer(function RefNameMenu({
  model,
  menuState,
  onClose,
}: {
  model: LGV
  menuState: MenuState
  onClose: () => void
}) {
  const { displayedRegions } = model
  const { refName, displayedRegionIndex: idx } = menuState
  const numRegions = displayedRegions.length
  const canMoveLeft = idx > 0
  const canMoveRight = idx < numRegions - 1
  const manyRegions = numRegions > 2

  function moveRegion(fromIndex: number, toIndex: number) {
    const regions = [...displayedRegions]
    const [removed] = regions.splice(fromIndex, 1)
    regions.splice(toIndex, 0, removed!)
    model.setDisplayedRegions(regions)
  }

  function removeRegion(index: number) {
    const regions = displayedRegions.filter((_, i) => i !== index)
    model.setDisplayedRegions(regions)
  }

  function reverseRegion(index: number) {
    const regions = displayedRegions.map((r, i) =>
      i === index ? { ...r, reversed: !r.reversed } : r,
    )
    model.setDisplayedRegions(regions)
  }

  return (
    <Menu
      anchorEl={menuState.anchorEl}
      open
      onClose={onClose}
      onMenuItemClick={callback => {
        callback()
        onClose()
      }}
      menuItems={[
        {
          label: `Focus on ${refName}`,
          onClick: () => {
            model.navTo({ refName })
          },
        },
        {
          label: 'Actions',
          subMenu: [
            {
              show: true,
              label: 'Reverse region',
              onClick: () => {
                reverseRegion(idx)
              },
            },
            {
              show: canMoveLeft,
              label: 'Move left',
              onClick: () => {
                moveRegion(idx, idx - 1)
              },
            },
            {
              show: canMoveRight,
              label: 'Move right',
              onClick: () => {
                moveRegion(idx, idx + 1)
              },
            },
            {
              show: manyRegions && canMoveLeft,
              label: 'Move to far left',
              onClick: () => {
                moveRegion(idx, 0)
              },
            },
            {
              show: manyRegions && canMoveRight,
              label: 'Move to far right',
              onClick: () => {
                moveRegion(idx, numRegions - 1)
              },
            },
            {
              show: numRegions > 1,
              label: 'Remove this region from view',
              onClick: () => {
                removeRegion(idx)
              },
            },
          ]
            .filter(item => item.show)
            .map(({ label, onClick }) => ({ label, onClick })),
        },
      ]}
    />
  )
})

export default ScalebarRefNameLabels
