import { useState } from 'react'

import { Menu } from '@jbrowse/core/ui'
import { assembleLocString, assembleLocStrings } from '@jbrowse/core/util'
import { copyText } from '@jbrowse/core/util/copyText'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  REF_NAME_LABEL_FONT_SIZE,
  regionMoveActions,
  regionRunBounds,
  setDisplayedRegionsKeepingCenter,
  withRegionMoved,
  withRegionRemoved,
  withRegionReversed,
  withRegionsKept,
} from '../util.ts'
import { scalebarRefLabelProps } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ScalebarRefNameLabel } from '../util.ts'

type LGV = LinearGenomeViewModel

interface MenuState {
  anchorEl: HTMLElement
  label: ScalebarRefNameLabel
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
    // clip, not hidden: transform/maxWidth are patched on every scroll-zoom
    // frame, and `hidden` would make each label its own scroll container —
    // scrollable-overflow bookkeeping and scroll anchoring per label per frame,
    // for a box that never scrolls. clip is a paint-time rect instead
    overflow: 'clip',
    whiteSpace: 'nowrap',
  },
  // refName labels only: the caption chip opens no menu
  clickable: {
    cursor: 'pointer',
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  caption: {
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

  const { labels, caption } = model.scalebarRefNameLabels

  return (
    <>
      {/* Keyed by position, which makes this list a pool: a zoom changes every
      run key at once, and keying by it rebuilt every label each frame of the
      gesture. See ScalebarCoordinateLabels. */}
      {labels.map((label, i) => (
        <RefLabel
          // eslint-disable-next-line @eslint-react/no-array-index-key -- position IS the identity here; keying by the run makes the list churn on zoom
          key={i}
          model={model}
          label={label}
          onOpenMenu={setMenuState}
        />
      ))}
      {caption === undefined ? null : (
        <span
          className={cx(classes.caption, classes.refLabel)}
          data-testid="refLabel-prefix"
        >
          {caption}
        </span>
      )}
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

// Not an observer: `label` is plain data from the parent. The attribute tells
// the scalebar's rubberband to leave a click here to this label's onClick.
function RefLabel({
  model,
  label,
  onOpenMenu,
}: {
  model: LGV
  label: ScalebarRefNameLabel
  onOpenMenu: (state: MenuState) => void
}) {
  const { classes, cx } = useStyles()
  const { refName, transform, maxWidth, paddingLeft, text } = label
  return (
    <span
      className={cx(classes.refLabel, classes.clickable)}
      style={{
        transform: `translateX(${transform}px)`,
        paddingLeft,
        maxWidth,
      }}
      data-testid={`refLabel-${refName}`}
      {...scalebarRefLabelProps}
      onClick={e => {
        model.setIsScalebarRefNameMenuOpen(true)
        onOpenMenu({ anchorEl: e.currentTarget, label })
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
  const {
    refName,
    displayedRegionIndex: idx,
    lastDisplayedRegionIndex: lastIdx,
  } = menuState.label
  const numRegions = displayedRegions.length
  const labeled = displayedRegions.slice(idx, lastIdx + 1)
  // A label naming several regions is the collapsed-intron case: adjacent
  // regions sharing a refName get one label between them. Reverse/move/remove
  // are per-region and this label names no particular one — it used to act on
  // whichever region the label happened to ride, which for the pinned label
  // changed as you scrolled — so a run offers only the two items that mean the
  // whole run.
  const oneRegion = idx === lastIdx
  // one region keeps its `{assembly}` qualifier; a run drops the qualifier the
  // regions all share, as the view header does for the same list
  const locString = oneRegion
    ? assembleLocString(displayedRegions[idx]!)
    : assembleLocStrings(labeled)
  // The region this label's blocks were cut out of. Taken over the WHOLE run
  // rather than `labeled`, which the viewport clips: a collapsed-introns view
  // zoomed into two exons would otherwise offer a span that is not the gene's.
  const { first: runFirst, last: runLast } = regionRunBounds(
    displayedRegions,
    idx,
    lastIdx,
  )
  const run = displayedRegions.slice(runFirst, runLast + 1)
  const wholeSpan = {
    ...run[0]!,
    start: Math.min(...run.map(r => r.start)),
    end: Math.max(...run.map(r => r.end)),
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
          // moveTo by index, not navTo by refName: navTo resolves to the FIRST
          // region carrying the name, so on a duplicated refName (a chromosome
          // displayed twice) clicking the third chr1 label jumped to the first.
          // Every other item in this menu is already idx-based.
          onClick: () => {
            const last = displayedRegions[lastIdx]!
            model.moveTo(
              { index: idx, offset: 0 },
              { index: lastIdx, offset: last.end - last.start },
            )
          },
        },
        ...(labeled.length < numRegions
          ? [
              {
                label: oneRegion
                  ? 'Show only this region'
                  : `Show only ${refName}`,
                onClick: () => {
                  setDisplayedRegionsKeepingCenter(
                    model,
                    withRegionsKept(displayedRegions, idx, lastIdx),
                  )
                },
              },
            ]
          : []),
        ...(runLast > runFirst
          ? [
              {
                // Names its subject the way the two rows above it do; the span
                // it lands on is not spelled into the label, which would move
                // under the reader as they navigate.
                label: `Show the whole span of ${refName}`,
                // Focused rather than centre-kept: the rejoined region is one
                // the old viewport never saw, so there is no centre to hold,
                // and showing the span is the whole point of the row.
                onClick: () => {
                  model.setDisplayedRegions([
                    ...displayedRegions.slice(0, runFirst),
                    wholeSpan,
                    ...displayedRegions.slice(runLast + 1),
                  ])
                  model.moveTo(
                    { index: runFirst, offset: 0 },
                    {
                      index: runFirst,
                      offset: wholeSpan.end - wholeSpan.start,
                    },
                  )
                },
              },
            ]
          : []),
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
                void copyText(model, locString, 'region')
              },
            },
          ],
        },
        ...(oneRegion
          ? [
              {
                label: 'Actions',
                subMenu: [
                  {
                    label: 'Reverse region',
                    onClick: () => {
                      setDisplayedRegionsKeepingCenter(
                        model,
                        withRegionReversed(displayedRegions, idx),
                      )
                    },
                  },
                  ...regionMoveActions(idx, numRegions).map(
                    ({ label, to }) => ({
                      label,
                      onClick: () => {
                        setDisplayedRegionsKeepingCenter(
                          model,
                          withRegionMoved(displayedRegions, idx, to),
                        )
                      },
                    }),
                  ),
                  ...(numRegions > 1
                    ? [
                        {
                          label: 'Remove this region from view',
                          onClick: () => {
                            setDisplayedRegionsKeepingCenter(
                              model,
                              withRegionRemoved(displayedRegions, idx),
                            )
                          },
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
      ]}
    />
  )
})

export default ScalebarRefNameLabels
