import type React from 'react'
import { useEffect, useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

interface MenuState {
  anchorEl: HTMLElement
  refName: string
  regionNumber: number
}

const useStyles = makeStyles()(theme => ({
  refLabel: {
    fontSize: 11,
    position: 'absolute',
    left: 2,
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
    left: 0,
    zIndex: 100,
  },
  scrollContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    willChange: 'transform',
  },
}))

// Inner component that only re-renders when staticBlocks change, NOT on
// scroll. This avoids re-creating/diffing potentially hundreds of label
// elements on every scroll frame. The observer memo prevents re-render
// when the parent re-renders due to offsetPx changes, since the only prop
// (model) is a stable reference and this component does not read offsetPx.
const ScrollingLabels = observer(function ScrollingLabels({
  model,
  setMenuState,
}: {
  model: LGV
  setMenuState: React.Dispatch<React.SetStateAction<MenuState | undefined>>
}) {
  // console.log('[ScrollingLabels] render')
  const { classes } = useStyles()
  const { staticBlocks } = model
  const containerOffset = staticBlocks.offsetPx

  const regionEndPx = new Map<number, number>()
  for (const block of staticBlocks.blocks) {
    if (block.type === 'ContentBlock' && block.regionNumber !== undefined) {
      const endPx = block.offsetPx + block.widthPx
      const current = regionEndPx.get(block.regionNumber)
      if (current === undefined || endPx > current) {
        regionEndPx.set(block.regionNumber, endPx)
      }
    }
  }

  const labels: React.ReactNode[] = []
  // eslint-disable-next-line unicorn/no-array-for-each
  staticBlocks.forEach((block, index) => {
    const {
      offsetPx: blockOffsetPx,
      isLeftEndOfDisplayedRegion,
      key,
      type,
      refName,
      regionNumber,
    } = block
    if (type !== 'ContentBlock' || !isLeftEndOfDisplayedRegion) {
      return
    }
    const regEndPx =
      regionNumber !== undefined ? regionEndPx.get(regionNumber) : undefined
    const maxWidth =
      regEndPx !== undefined ? regEndPx - blockOffsetPx - 2 : undefined
    if (maxWidth !== undefined && maxWidth < 20) {
      return
    }
    labels.push(
      <span
        key={`refLabel-${key}-${index}`}
        style={{
          left: blockOffsetPx - containerOffset - 1,
          paddingLeft: 1,
          maxWidth:
            maxWidth !== undefined && maxWidth > 0 ? maxWidth : undefined,
        }}
        className={classes.refLabel}
        data-testid={`refLabel-${refName}`}
        onMouseDown={() => {
          model.setScalebarRefNameClickPending(true)
        }}
        onClick={event => {
          model.setScalebarRefNameClickPending(false)
          setMenuState({
            anchorEl: event.currentTarget,
            refName,
            regionNumber: regionNumber!,
          })
        }}
      >
        {refName}
      </span>,
    )
  })
  // console.log('[ScrollingLabels]', labels.length, 'labels')
  return <>{labels}</>
})

const ScalebarRefNameLabels = observer(function ScalebarRefNameLabels({
  model,
}: {
  model: LGV
}) {
  // console.log('[ScalebarRefNameLabels] render')
  const { classes, cx } = useStyles()
  const { staticBlocks, offsetPx, scalebarDisplayPrefix } = model
  const [menuState, setMenuState] = useState<MenuState>()

  useEffect(() => {
    model.setIsScalebarRefNameMenuOpen(!!menuState)
  }, [model, menuState])

  // find the block that needs pinning to the left side for context
  // default to first ContentBlock if nothing is scrolled left
  let lastLeftBlock = staticBlocks.blocks.findIndex(
    b => b.type === 'ContentBlock',
  )
  if (lastLeftBlock < 0) {
    lastLeftBlock = 0
  }

  // eslint-disable-next-line unicorn/no-array-for-each
  staticBlocks.forEach((block, i) => {
    if (block.type === 'ContentBlock' && block.offsetPx - offsetPx < 0) {
      lastLeftBlock = i
    }
  })
  const val = scalebarDisplayPrefix()
  const b0 = staticBlocks.blocks[0]
  const containerOffset = staticBlocks.offsetPx
  const translateX = Math.round(containerOffset - offsetPx)

  // Build pinned label (only 1 element updates its left per scroll frame)
  const pinnedBlock = staticBlocks.blocks[lastLeftBlock]
  let pinnedLabel: React.ReactNode = null
  if (pinnedBlock?.type === 'ContentBlock') {
    let pinnedRegionEndPx: number | undefined
    if (pinnedBlock.regionNumber !== undefined) {
      for (const block of staticBlocks.blocks) {
        if (
          block.type === 'ContentBlock' &&
          block.regionNumber === pinnedBlock.regionNumber
        ) {
          const endPx = block.offsetPx + block.widthPx
          if (pinnedRegionEndPx === undefined || endPx > pinnedRegionEndPx) {
            pinnedRegionEndPx = endPx
          }
        }
      }
    }
    const maxWidth =
      pinnedRegionEndPx !== undefined
        ? pinnedRegionEndPx - offsetPx - 2
        : undefined
    if (maxWidth === undefined || maxWidth >= 20) {
      pinnedLabel = (
        <span
          style={{
            left: Math.max(0, -offsetPx),
            maxWidth:
              maxWidth !== undefined && maxWidth > 0 ? maxWidth : undefined,
          }}
          className={classes.refLabel}
          data-testid={`refLabel-${pinnedBlock.refName}`}
          onMouseDown={() => {
            model.setScalebarRefNameClickPending(true)
          }}
          onClick={event => {
            model.setScalebarRefNameClickPending(false)
            setMenuState({
              anchorEl: event.currentTarget,
              refName: pinnedBlock.refName,
              regionNumber: pinnedBlock.regionNumber!,
            })
          }}
        >
          {val ? `${val}:` : ''}
          {pinnedBlock.refName}
        </span>
      )
    }
  }

  return (
    <>
      {b0?.type !== 'ContentBlock' && val ? (
        <span className={cx(classes.b0, classes.refLabel)}>{val}</span>
      ) : null}
      <div
        className={classes.scrollContainer}
        style={{ transform: `translateX(${translateX}px)` }}
      >
        <ScrollingLabels model={model} setMenuState={setMenuState} />
      </div>
      {pinnedLabel}
      {menuState ? (
        <RefNameMenu
          model={model}
          menuState={menuState}
          onClose={() => {
            setMenuState(undefined)
          }}
        />
      ) : null}
    </>
  )
})

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
  const { refName, regionNumber } = menuState
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

  const actionItems = [
    ...(regionNumber > 0
      ? [
          {
            label: 'Move left',
            onClick: () => {
              moveRegion(regionNumber, regionNumber - 1)
            },
          },
        ]
      : []),
    ...(regionNumber < numRegions - 1
      ? [
          {
            label: 'Move right',
            onClick: () => {
              moveRegion(regionNumber, regionNumber + 1)
            },
          },
        ]
      : []),
    ...(numRegions > 2 && regionNumber > 0
      ? [
          {
            label: 'Move to far left',
            onClick: () => {
              moveRegion(regionNumber, 0)
            },
          },
        ]
      : []),
    ...(numRegions > 2 && regionNumber < numRegions - 1
      ? [
          {
            label: 'Move to far right',
            onClick: () => {
              moveRegion(regionNumber, numRegions - 1)
            },
          },
        ]
      : []),
    {
      label: 'Remove this region from view',
      onClick: () => {
        removeRegion(regionNumber)
      },
    },
  ]

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
        ...(numRegions > 1
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
