import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { assembleLocString } from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  REF_NAME_LABEL_FONT_SIZE,
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
    // the width the fit test in getScalebarRefNameLabels measures against
    fontSize: REF_NAME_LABEL_FONT_SIZE,
    // maxWidth is the label's whole box, paddingLeft included — stated here
    // rather than inherited from whatever box-sizing the embedding page sets,
    // since under content-box the padding comes off the text twice (once in the
    // maxWidth the fit test was given, once in the layout) and every name wide
    // enough to need the space is clipped mid-glyph
    boxSizing: 'border-box',
    position: 'absolute',
    // x-position is driven by transform:translateX (compositor-only) not left
    left: 0,
    top: -1,
    fontWeight: 'bold',
    lineHeight: 'normal',
    zIndex: 1,
    background: theme.palette.background.paper,
    cursor: 'pointer',
    // clip, not hidden: transform/maxWidth are patched on every scroll-zoom
    // frame, and `hidden` would make each label its own scroll container —
    // scrollable-overflow bookkeeping and scroll anchoring per label per frame,
    // for a box that never scrolls. clip is a paint-time rect instead
    overflow: 'clip',
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
  // `model.scalebarRefNameLabels`, not a getScalebarRefNameLabels call of its
  // own: a host drawing its own region names reads the same getter, so the
  // sticky/dedup/fit rules can't be one thing here and another there. The SVG
  // export still calls the helper directly, deliberately and with no prefix.
  const { labels, showPrefixFallback } = model.scalebarRefNameLabels

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
      {/* Bare assembly name pinned far-left whenever no sticky label folded it
      in: the view is scrolled left of its first region (so that label sits out
      at the region's own edge), or the leftmost region had no room for a label
      at all. Either way the row still says which assembly it is. */}
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
          // moveTo by index, not navTo by refName: navTo resolves to the FIRST
          // region carrying the name, so on a duplicated refName (collapsed
          // introns, a chromosome displayed twice) clicking the third chr1 label
          // jumped to the first. Every other item in this menu is already
          // idx-based.
          onClick: () => {
            const region = displayedRegions[idx]!
            model.moveTo(
              { index: idx, offset: 0 },
              { index: idx, offset: region.end - region.start },
            )
          },
        },
        {
          label: 'Copy to clipboard',
          subMenu: [
            {
              label: 'Reference sequence name',
              onClick: () => {
                void copyText(model, refName, 'reference sequence name')
              },
            },
            {
              label: 'Region',
              onClick: () => {
                void copyText(
                  model,
                  assembleLocString(displayedRegions[idx]!),
                  'region',
                )
              },
            },
          ],
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
