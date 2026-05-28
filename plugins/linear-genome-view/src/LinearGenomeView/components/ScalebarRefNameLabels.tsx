import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

interface MenuState {
  anchorEl: HTMLElement
  refName: string
  displayedRegionIndex: number | undefined
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
  const val = model.scalebarDisplayPrefix()
  const regionEndPx = model.scalebarRegionEndPx

  // Sticky label: rightmost content block whose left edge is within/before the
  // viewport. Falls back to the first content block if none are left of viewport.
  const firstContentIdx = blocks.findIndex(b => b.type === 'ContentBlock')
  let lastLeftBlock = firstContentIdx
  for (let i = firstContentIdx + 1; i < blocks.length; i++) {
    const b = blocks[i]!
    if (b.type === 'ContentBlock' && b.offsetPx < offsetPx) {
      lastLeftBlock = i
    }
  }

  const labels = []

  if (blocks[0]?.type !== 'ContentBlock' && val) {
    labels.push(
      <span
        key="b0"
        className={cx(classes.b0, classes.refLabel)}
        data-testid="refLabel-prefix"
      >
        {val}
      </span>,
    )
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!
    if (block.type !== 'ContentBlock') {
      continue
    }
    const sticky = i === lastLeftBlock
    if (!block.isLeftEndOfDisplayedRegion && !sticky) {
      continue
    }
    const layout = getLabelLayout(block, offsetPx, regionEndPx, sticky)
    if (!layout) {
      continue
    }
    const { transform, maxWidth } = layout
    const { refName, displayedRegionIndex } = block
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
            displayedRegionIndex,
          })
        }}
      >
        {sticky && val ? `${val}:${refName}` : refName}
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

function buildActionItems(
  displayedRegionIndex: number,
  numRegions: number,
  move: (from: number, to: number) => void,
  remove: (index: number) => void,
) {
  return [
    ...(displayedRegionIndex > 0
      ? [
          {
            label: 'Move left',
            onClick: () => {
              move(displayedRegionIndex, displayedRegionIndex - 1)
            },
          },
        ]
      : []),
    ...(displayedRegionIndex < numRegions - 1
      ? [
          {
            label: 'Move right',
            onClick: () => {
              move(displayedRegionIndex, displayedRegionIndex + 1)
            },
          },
        ]
      : []),
    ...(numRegions > 2 && displayedRegionIndex > 0
      ? [
          {
            label: 'Move to far left',
            onClick: () => {
              move(displayedRegionIndex, 0)
            },
          },
        ]
      : []),
    ...(numRegions > 2 && displayedRegionIndex < numRegions - 1
      ? [
          {
            label: 'Move to far right',
            onClick: () => {
              move(displayedRegionIndex, numRegions - 1)
            },
          },
        ]
      : []),
    {
      label: 'Remove this region from view',
      onClick: () => {
        remove(displayedRegionIndex)
      },
    },
  ]
}

function RefNameMenu({
  model,
  menuState,
  onClose,
}: {
  model: LGV
  menuState: MenuState
  onClose: () => void
}) {
  const { displayedRegions } = model
  const { refName, displayedRegionIndex } = menuState
  const numRegions = displayedRegions.length

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

  const canManageRegions = displayedRegionIndex !== undefined && numRegions > 1
  const actionItems = canManageRegions
    ? buildActionItems(
        displayedRegionIndex,
        numRegions,
        moveRegion,
        removeRegion,
      )
    : []

  return (
    <Menu
      anchorEl={menuState.anchorEl}
      open
      onClose={onClose}
      onMenuItemClick={(_, callback) => {
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
        ...(canManageRegions
          ? [
              {
                label: 'Actions',
                subMenu: actionItems,
              },
            ]
          : []),
      ]}
    />
  )
}

export default ScalebarRefNameLabels
