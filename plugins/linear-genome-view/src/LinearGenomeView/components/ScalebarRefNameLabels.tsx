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
}))

const ScalebarRefNameLabels = observer(function ScalebarRefNameLabels({
  model,
}: {
  model: LGV
}) {
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

  // Calculate the end position (in pixels) of each displayed region
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

  return (
    <>
      {b0?.type !== 'ContentBlock' && val ? (
        <span className={cx(classes.b0, classes.refLabel)}>{val}</span>
      ) : null}
      {staticBlocks.map((block, index) => {
        const {
          offsetPx: blockOffsetPx,
          isLeftEndOfDisplayedRegion,
          key,
          type,
          refName,
          regionNumber,
        } = block
        const last = index === lastLeftBlock
        // Calculate max width to clip label at the displayed region boundary
        const regEndPx =
          regionNumber !== undefined ? regionEndPx.get(regionNumber) : undefined
        const labelStartPx = last ? offsetPx : blockOffsetPx
        const maxWidth =
          regEndPx !== undefined ? regEndPx - labelStartPx - 2 : undefined
        // Don't render label if available width is too small (avoids overlap slivers)
        const minLabelWidth = 20
        const hasEnoughSpace =
          maxWidth === undefined || maxWidth >= minLabelWidth
        return type === 'ContentBlock' &&
          (isLeftEndOfDisplayedRegion || last) &&
          hasEnoughSpace ? (
          <span
            key={`refLabel-${key}-${index}`}
            style={{
              left: last
                ? Math.max(0, -offsetPx)
                : blockOffsetPx - offsetPx - 1,
              paddingLeft: last ? 0 : 1,
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
            {last && val ? `${val}:` : ''}
            {refName}
          </span>
        ) : null
      })}
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
