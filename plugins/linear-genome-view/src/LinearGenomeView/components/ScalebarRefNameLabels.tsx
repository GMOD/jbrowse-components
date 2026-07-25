import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  getScalebarRefNameLabels,
  regionMoveActions,
  withRegionMoved,
  withRegionRemoved,
  withRegionReversed,
} from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ScalebarRefNameLabel } from '../util.ts'

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

  const prefix = model.scalebarDisplayPrefix
  const { labels, showPrefixFallback } = getScalebarRefNameLabels({
    blocks: model.staticBlocks.blocks,
    offsetPx: model.offsetPx,
    regionEndPx: model.scalebarRegionEndPx,
    prefix,
  })

  return (
    <>
      {labels.map(label => (
        <RefLabel
          key={label.key}
          model={model}
          label={label}
          onOpenMenu={state => {
            setMenuState(state)
          }}
        />
      ))}
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

// One refName label. Not an observer: `label` is already plain data computed by
// the parent, and `model` is only used to fire actions. mouseDown flags the
// click as starting on a label so the scalebar's rubberband hands the click to
// this label's own onClick instead of opening the range menu.
function RefLabel({
  model,
  label,
  onOpenMenu,
}: {
  model: LGV
  label: ScalebarRefNameLabel
  onOpenMenu: (state: MenuState) => void
}) {
  const { classes } = useStyles()
  const {
    refName,
    displayedRegionIndex,
    transform,
    maxWidth,
    paddingLeft,
    text,
  } = label
  return (
    <span
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
        onOpenMenu({ anchorEl: e.currentTarget, refName, displayedRegionIndex })
      }}
    >
      {text}
    </span>
  )
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
  const { canMoveLeft, canMoveRight, canMoveFarLeft, canMoveFarRight } =
    regionMoveActions(idx, numRegions)
  const moves = [
    { show: canMoveLeft, label: 'Move left', to: idx - 1 },
    { show: canMoveRight, label: 'Move right', to: idx + 1 },
    { show: canMoveFarLeft, label: 'Move to far left', to: 0 },
    { show: canMoveFarRight, label: 'Move to far right', to: numRegions - 1 },
  ]

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
              label: 'Reverse region',
              onClick: () => {
                model.setDisplayedRegions(
                  withRegionReversed(displayedRegions, idx),
                )
              },
            },
            ...moves
              .filter(m => m.show)
              .map(({ label, to }) => ({
                label,
                onClick: () => {
                  model.setDisplayedRegions(
                    withRegionMoved(displayedRegions, idx, to),
                  )
                },
              })),
            ...(numRegions > 1
              ? [
                  {
                    label: 'Remove this region from view',
                    onClick: () => {
                      model.setDisplayedRegions(
                        withRegionRemoved(displayedRegions, idx),
                      )
                    },
                  },
                ]
              : []),
          ],
        },
      ]}
    />
  )
})

export default ScalebarRefNameLabels
