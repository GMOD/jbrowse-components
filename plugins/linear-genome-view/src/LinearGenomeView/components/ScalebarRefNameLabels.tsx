import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { getScalebarRefNameLabels, regionMoveActions } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

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
      // action.hover is a mode-aware translucent overlay; the old hardcoded
      // grey[300] stayed light in dark mode, washing out the light label text
      background: theme.palette.action.hover,
    },
  },
  prefixLabel: {
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

  const prefix = model.scalebarDisplayPrefix()
  const { labels, showPrefixFallback } = getScalebarRefNameLabels({
    blocks: model.staticBlocks.blocks,
    offsetPx: model.offsetPx,
    regionEndPx: model.scalebarRegionEndPx,
    prefix,
  })

  return (
    <>
      <div>
        {labels.map(
          ({
            key,
            refName,
            displayedRegionIndex,
            transform,
            maxWidth,
            paddingLeft,
            text,
          }) => (
            <span
              key={key}
              className={classes.refLabel}
              style={{
                transform: `translateX(${transform}px)`,
                paddingLeft,
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
              {text}
            </span>
          ),
        )}
        {/* Fallback: bare assembly name pinned far-left when no sticky label
        carried it (e.g. the leftmost region was too narrow to label) */}
        {showPrefixFallback ? (
          <span
            className={cx(classes.prefixLabel, classes.refLabel)}
            data-testid="refLabel-prefix"
          >
            {prefix}
          </span>
        ) : null}
      </div>
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
  const { canMoveLeft, canMoveRight, canMoveFarLeft, canMoveFarRight } =
    regionMoveActions(idx, numRegions)

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
              show: true,
              label: 'Horizontally flip view',
              onClick: () => {
                model.horizontallyFlip()
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
              show: canMoveFarLeft,
              label: 'Move to far left',
              onClick: () => {
                moveRegion(idx, 0)
              },
            },
            {
              show: canMoveFarRight,
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
