import { useLayoutEffect, useState } from 'react'

// deep subpaths, never the `@jbrowse/core/ui` barrel: a display renders this
// legend directly, so it sits behind neither bring-your-own seam, and one named
// import of that barrel lands FileSelector, FatalErrorDialog and the
// cascading-menu stack in the chunk. `muiFree.test.ts` fails on it.
import { LegendSwatchGlyph } from '@jbrowse/core/ui/LegendSwatchGlyph'
import {
  legendSwatches,
  nonEmptyLegendSections,
} from '@jbrowse/core/ui/legendSpec'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  FLOATING_LEGEND_RIGHT_PX,
  FLOATING_LEGEND_TOP_PX,
} from './floatingLegendTop.ts'
import Tooltip from './tooltip/Tooltip.tsx'
import { TrackOverlayPortal } from './trackOverlay/TrackOverlayPortal.tsx'

import type {
  LegendGradient,
  LegendItem,
  LegendSection,
} from '@jbrowse/core/ui/legendSpec'

const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    background: theme.palette.background.paper,
    // A hairline edge, because `background.paper` on a track whose canvas is
    // also paper-white is no edge at all: the key read as loose text floating
    // over the features rather than as a panel, and the swatches were the only
    // thing announcing it (reviewer, on cookbook_color_by_type: "legend needs a
    // light border ... very subtle. just enough to notice because it is hard to
    // see at a glance"). `divider` is the theme's own hairline, so this stays
    // right in both themes and against a dark track.
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    padding: '2px 3px',
    display: 'flex',
    flexDirection: 'column',
    fontSize: 10,
    lineHeight: `${ROW_HEIGHT}px`,
    zIndex: 100,
    // the default; `maxWidth` overrides it per display
    // portaled into the TrackContainer's above-the-masks overlay node, which is
    // pointer-events:none so it doesn't eat canvas events; re-enable events on
    // the legend itself so its close buttons/links stay clickable (harmless when
    // rendered inline, where events already pass through)
    pointerEvents: 'auto',
  },
  // A plain <button> with a `×` glyph, not MUI: displays render this legend
  // directly, behind neither bring-your-own seam. See DISPLAYCHROME.md, "The
  // bring-your-own seams".
  // Paper behind the glyph, as rows scroll under it.
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 1,
    font: 'inherit',
    lineHeight: 1,
    padding: '2px 3px',
    border: 0,
    borderRadius: 3,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  // Only the key's first line runs under the close button.
  clearsClose: {
    paddingRight: CLOSE_CLEARANCE,
  },
  // A key taller than its display scrolls here. The platform may hide an
  // overlay scrollbar, so `moreBelow` names the entries past the fold.
  scroller: {
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    minHeight: 0,
  },
  moreBelow: {
    font: 'inherit',
    flexShrink: 0,
    marginTop: 1,
    padding: '1px 0 0',
    border: 0,
    borderTop: `1px solid ${theme.palette.divider}`,
    background: 'none',
    textAlign: 'left',
    color: theme.palette.accent,
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  topTitle: {
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginBottom: 1,
  },
  section: {
    '&:not(:last-child)': {
      marginBottom: 3,
    },
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 1,
  },
  // A key too long to list: one line that lists the rows on a click.
  summary: {
    font: 'inherit',
    padding: 0,
    border: 0,
    background: 'none',
    color: 'inherit',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  disclosure: {
    color: theme.palette.accent,
  },
  sectionTitle: {
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Wraps where every other line ellipsizes: a note is a sentence, and half of
  // one says nothing.
  sectionNote: {
    color: theme.palette.text.secondary,
    whiteSpace: 'normal',
    marginBottom: 1,
  },
  sectionClose: {
    font: 'inherit',
    lineHeight: 1,
    padding: 0,
    marginLeft: 2,
    border: 0,
    background: 'none',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  item: {
    display: 'flex',
    alignItems: 'center',
  },
  // A row that acts: the same layout, as a plain button (see `closeButton`
  // for why not Material's), so a key naming groups of rows can focus one.
  itemButton: {
    font: 'inherit',
    padding: 0,
    border: 0,
    background: 'none',
    width: '100%',
    textAlign: 'left',
    color: 'inherit',
    cursor: 'pointer',
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  swatches: {
    display: 'flex',
    gap: 2,
    marginRight: 4,
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  hiddenItem: {
    opacity: 0.4,
    textDecoration: 'line-through',
  },
  gradientRow: {
    marginBottom: 1,
  },
  gradientBar: {
    width: GRADIENT_BAR_WIDTH,
    height: 10,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
    // clip the gradient to the padding box so it doesn't paint under the
    // translucent divider border — otherwise the border composites over the
    // gradient's end and the edge renders a dark sliver
    backgroundClip: 'padding-box',
  },
  gradientLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    width: GRADIENT_BAR_WIDTH,
  },
  // was `<Link component="button" underline="hover">`, which is the same
  // element with Material's typography on it — see `closeButton` above for why
  // that mattered
  toggle: {
    font: 'inherit',
    display: 'block',
    marginTop: 1,
    padding: 0,
    border: 0,
    background: 'none',
    textAlign: 'left',
    color: theme.palette.accent,
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}))

const DEFAULT_MAX_ITEMS = 12
const DEFAULT_MAX_WIDTH = 200
const GRADIENT_BAR_WIDTH = 100

// Side of one swatch box, as the export draws it (`LEGEND_SWATCH`).
const SWATCH = 10
// One line of text or swatches.
const ROW_HEIGHT = 12
// What the first line leaves free for the close button.
const CLOSE_CLEARANCE = 13

// The spec itself lives in core beside SvgColorLegend, so the export legends can
// flatten the very value this component renders (see legendEntries). Re-exported
// here because every display already imports it from this plugin.
export type {
  LegendGradient,
  LegendItem,
  LegendSection,
  LegendSpec,
  LegendSwatch,
} from '@jbrowse/core/ui/legendSpec'

// A ramp row: the caption, the bar and the domain ends. The bar is a CSS
// gradient over the same stops the export's <linearGradient> takes, so the
// two draw one ramp. Stops are flattened over the paper because a translucent
// first stop (Hi-C's juicebox fade) rasterizes to a dark sliver at the bar's
// left edge.
function gradientCss({ stops }: LegendGradient, paper: string) {
  const list = stops.map(({ color, opacity = 1, offset }) => {
    const flat =
      opacity >= 1
        ? color
        : `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, ${paper})`
    return `${flat} ${offset * 100}%`
  })
  return `linear-gradient(to right, ${list.join(', ')})`
}

const GradientRow = observer(function GradientRow({
  label,
  gradient,
  className,
}: {
  label: string
  gradient: LegendGradient
  className?: string
}) {
  const { classes, theme } = useStyles()
  return (
    <div className={cx(classes.gradientRow, className)} data-legend-count={1}>
      {label ? <div className={classes.label}>{label}</div> : null}
      <div
        className={classes.gradientBar}
        // backgroundImage (longhand), not the `background` shorthand: the
        // shorthand resets background-clip back to border-box, undoing the
        // padding-box clip
        style={{
          backgroundImage: gradientCss(
            gradient,
            theme.palette.background.paper,
          ),
        }}
      />
      <div className={classes.gradientLabels}>
        <span>{gradient.minLabel}</span>
        <span>{gradient.maxLabel}</span>
      </div>
    </div>
  )
})

// One list of swatches with its own independent collapse state, so each section
// in a multi-section legend expands/collapses on its own.
const LegendItemList = observer(function LegendItemList({
  items,
  maxItems,
  onItemClick,
  firstRowClass,
}: {
  items: LegendItem[]
  maxItems: number
  onItemClick?: (item: LegendItem) => void
  firstRowClass?: string
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  // A toggle revealing one row costs the row it saves.
  const collapsible = items.length > maxItems + 1
  const shown = collapsible && !expanded ? items.slice(0, maxItems) : items
  const hiddenCount = items.length - maxItems
  // Every row reserves the widest row's swatch column, collapsed or not, so
  // labels stay in one vertical line and do not shift on expanding.
  const columns = Math.max(1, ...items.map(i => legendSwatches(i).length))
  return (
    <>
      {shown.map((item, i) => {
        if (item.gradient) {
          return (
            <GradientRow
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={`${item.label}-${i}`}
              label={item.label}
              gradient={item.gradient}
              className={i === 0 ? firstRowClass : undefined}
            />
          )
        }
        const row = (
          <>
            <div
              className={classes.swatches}
              style={{ minWidth: columns * SWATCH + (columns - 1) * 2 }}
            >
              {legendSwatches(item).map(swatch => (
                <svg
                  key={`${swatch.shape}-${swatch.color}`}
                  width={SWATCH}
                  height={SWATCH}
                >
                  <LegendSwatchGlyph swatch={swatch} size={SWATCH} />
                </svg>
              ))}
            </div>
            <span className={classes.label}>{item.label}</span>
          </>
        )
        const itemClass = cx(
          classes.item,
          item.hidden && classes.hiddenItem,
          i === 0 && firstRowClass,
        )
        return onItemClick && legendSwatches(item).length > 0 ? (
          <button
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${item.label}-${i}`}
            type="button"
            className={cx(itemClass, classes.itemButton)}
            data-legend-count={1}
            title="Show only these rows"
            onClick={() => {
              onItemClick(item)
            }}
          >
            {row}
          </button>
        ) : (
          <div
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${item.label}-${i}`}
            className={itemClass}
            data-legend-count={1}
          >
            {row}
          </div>
        )
      })}
      {collapsible ? (
        <button
          type="button"
          className={classes.toggle}
          data-legend-count={expanded ? undefined : hiddenCount}
          onClick={() => {
            setExpanded(!expanded)
          }}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more…`}
        </button>
      ) : null}
    </>
  )
})

// One vocabulary: its header where titles show, its note, and its rows — or,
// for a `summary` section, that one line, which lists the rows on a click.
const LegendSectionView = observer(function LegendSectionView({
  section,
  multiSection,
  maxItems,
  firstLineClass,
  onDismissSection,
  onItemClick,
}: {
  section: LegendSection
  multiSection: boolean
  maxItems: number
  firstLineClass?: string
  onDismissSection?: (id: string) => void
  onItemClick?: (item: LegendItem) => void
}) {
  const { classes } = useStyles()
  const [listed, setListed] = useState(false)
  const { summary, title, note } = section
  const heading =
    summary === undefined ? (
      multiSection && title ? (
        <span className={classes.sectionTitle}>{title}</span>
      ) : null
    ) : (
      <button
        type="button"
        className={classes.summary}
        aria-expanded={listed}
        title={listed ? 'Hide the values' : 'List every value'}
        data-legend-count={1}
        onClick={() => {
          setListed(!listed)
        }}
      >
        {summary}{' '}
        <span className={classes.disclosure}>{listed ? '▾' : '▸'}</span>
      </button>
    )
  const showRows = summary === undefined || listed
  return (
    <div className={classes.section}>
      {heading ? (
        <div className={cx(classes.sectionHeader, firstLineClass)}>
          {heading}
          {multiSection && onDismissSection ? (
            <Tooltip title={`Hide ${title ?? 'section'}`}>
              <button
                type="button"
                className={classes.sectionClose}
                aria-label={`Hide ${title ?? 'section'}`}
                onClick={() => {
                  onDismissSection(section.id)
                }}
              >
                ×
              </button>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
      {note ? (
        <div className={cx(classes.sectionNote, !heading && firstLineClass)}>
          {note}
        </div>
      ) : null}
      {showRows ? (
        <LegendItemList
          items={section.items}
          maxItems={summary === undefined ? maxItems : Infinity}
          onItemClick={onItemClick}
          firstRowClass={heading || note ? undefined : firstLineClass}
        />
      ) : null}
    </div>
  )
})

// How many entries `scroller` holds below its visible bottom. Each row counts
// one, and a collapsed "Show N more" toggle counts the rows it hides.
function entriesBelow(scroller: HTMLElement) {
  const { bottom } = scroller.getBoundingClientRect()
  let count = 0
  for (const el of scroller.querySelectorAll<HTMLElement>(
    '[data-legend-count]',
  )) {
    if (el.getBoundingClientRect().bottom > bottom + 1) {
      count += Number(el.dataset.legendCount)
    }
  }
  return count
}

// The scroller's entries below the fold, recounted on scroll, resize and any
// change to its rows. While the key can scroll, a wheel anywhere over it is the
// key's alone, so it neither zooms nor pans the view beneath; ctrl/meta still
// zoom, and a sideways swipe still pans.
function useEntriesBelow(scroller: HTMLDivElement | null) {
  const [below, setBelow] = useState(0)
  useLayoutEffect(() => {
    if (!scroller) {
      return
    }
    const update = () => {
      setBelow(entriesBelow(scroller))
    }
    const onWheel = (e: WheelEvent) => {
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        Math.abs(e.deltaY) >= Math.abs(e.deltaX) &&
        scroller.scrollHeight > scroller.clientHeight
      ) {
        e.stopPropagation()
      }
    }
    const box = scroller.parentElement!
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    box.addEventListener('wheel', onWheel, { passive: true })
    const mutations = new MutationObserver(update)
    mutations.observe(scroller, { childList: true, subtree: true })
    const resizes =
      'ResizeObserver' in window ? new ResizeObserver(update) : undefined
    resizes?.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', update)
      box.removeEventListener('wheel', onWheel)
      mutations.disconnect()
      resizes?.disconnect()
    }
  }, [scroller])
  return below
}

// Floating color-key overlay: one panel per section (e.g. genotype colors vs.
// sample-grouping colors on the multi-sample variant display). Section titles
// and per-section close buttons only appear when there is more than one
// section, so a single-scheme legend is just its rows. `title` is a heading
// for the whole box, shown regardless of section count. A section with a
// `summary` draws that one line, which lists its rows on a click.
//
// `onItemClick` makes the rows of a section declaring `focusesRows` act —
// clicking an entry focuses the rows it names. A section coloring features or
// cells stays inert text beside it.
//
// The key covers data at the lane's top right, an overlap Colin accepted on
// 2026-09-30. A lane shorter than the key scrolls it, and a "N more" row under
// the visible entries names what lies below, so neither the screen nor a still
// of it hides an entry.
const FloatingLegend = observer(function FloatingLegend({
  sections,
  title,
  onDismiss,
  onDismissSection,
  onItemClick,
  maxItems = DEFAULT_MAX_ITEMS,
  maxWidth = DEFAULT_MAX_WIDTH,
  top = FLOATING_LEGEND_TOP_PX,
  right = FLOATING_LEGEND_RIGHT_PX,
}: {
  sections: readonly LegendSection[]
  title?: string
  onDismiss?: () => void
  onDismissSection?: (id: string) => void
  onItemClick?: (item: LegendItem, section: LegendSection) => void
  maxItems?: number
  // How wide the box may grow before labels ellipsize. The box floats OVER the
  // data, so this is an occlusion budget, not a text budget — which is why it is
  // per-display rather than sized to whichever plugin has the longest label.
  // Raise it for a vocabulary that genuinely needs the words (alignments, whose
  // split-read rows have to say which kind of read they classify); leave it for
  // everything else, and let the ellipsis be the signal that a label is too long.
  maxWidth?: number
  // Distances from the top and right of the display box. `ChromeLegend` adds
  // axis captions to the top and a display's `legendRight` clearance to the
  // right, for a display that already draws something in that corner.
  top?: number
  right?: number
}) {
  const { classes } = useStyles()
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null)
  const below = useEntriesBelow(scroller)

  const nonEmpty = nonEmptyLegendSections(sections)
  if (nonEmpty.length === 0) {
    return null
  }

  const multiSection = nonEmpty.length > 1
  // portal above the inter-region padding masks so the key isn't buried at
  // whole-genome / multi-region scale (see TrackOverlayPortal)
  return (
    <TrackOverlayPortal>
      <div
        className={classes.legend}
        style={{
          top,
          right,
          maxWidth,
          maxHeight: `calc(100% - ${top + 4}px)`,
        }}
        // Same doctrine as `plainChromeOverlays`' testids: a stable hook for the
        // harnesses that have to find this box. The build-your-own site's smoke
        // census needs it to prove the zero it reports for a page showing a
        // legend is a legend that rendered, rather than a legend that never
        // appeared — see `ultraminimal`'s unearned zero in that file.
        data-testid="floating-legend"
        // Claims the press, so a drag that starts on the key isn't the LGV's
        // pan (`useSideScroll` tests `closest('[data-gesture-owner]')`), which
        // would move the view under the legend and block selecting its text.
        // The marker, not `stopPropagation`: the pan reads `event.target` off
        // a bubbling pointerdown, and stopping that would also cost
        // focus-on-click (`useFocusOnInteraction`).
        data-gesture-owner="true"
      >
        {onDismiss ? (
          <Tooltip title="Hide legend">
            <button
              type="button"
              className={classes.closeButton}
              aria-label="Hide legend"
              onClick={() => {
                onDismiss()
              }}
            >
              ×
            </button>
          </Tooltip>
        ) : null}
        <div ref={setScroller} className={classes.scroller}>
          {title ? (
            <div
              className={cx(classes.topTitle, onDismiss && classes.clearsClose)}
            >
              {title}
            </div>
          ) : null}
          {nonEmpty.map((section, i) => (
            <LegendSectionView
              key={section.id}
              section={section}
              multiSection={multiSection}
              maxItems={maxItems}
              firstLineClass={
                onDismiss && !title && i === 0 ? classes.clearsClose : undefined
              }
              onDismissSection={onDismissSection}
              onItemClick={
                onItemClick && section.focusesRows
                  ? item => {
                      onItemClick(item, section)
                    }
                  : undefined
              }
            />
          ))}
        </div>
        {below > 0 && scroller ? (
          <button
            type="button"
            className={classes.moreBelow}
            onClick={() => {
              scroller.scrollTop += Math.max(
                SWATCH,
                scroller.clientHeight - SWATCH,
              )
            }}
          >
            {below} more ▾
          </button>
        ) : null}
      </div>
    </TrackOverlayPortal>
  )
})

export default FloatingLegend
