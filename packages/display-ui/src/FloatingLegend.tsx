import { useState } from 'react'

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

import Tooltip from './tooltip/Tooltip.tsx'
import { TrackOverlayPortal } from './trackOverlay/TrackOverlayPortal.tsx'

import type { LegendItem, LegendSection } from '@jbrowse/core/ui/legendSpec'

const useStyles = makeStyles()(theme => ({
  legend: {
    position: 'absolute',
    right: 10,
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
    padding: 3,
    fontSize: 10,
    zIndex: 100,
    // the default; `maxWidth` overrides it per display
    // portaled into the TrackContainer's above-the-masks overlay node, which is
    // pointer-events:none so it doesn't eat canvas events; re-enable events on
    // the legend itself so its close buttons/links stay clickable (harmless when
    // rendered inline, where events already pass through)
    pointerEvents: 'auto',
  },
  // A plain <button>, not MUI's IconButton, and the glyph is `×` rather than
  // the Material Close icon.
  //
  // This component is rendered by canvas, alignments, variants and multi-wiggle
  // displays *directly*, behind neither bring-your-own seam, so a Material
  // widget here reaches an embedder who has opted out of both — and the
  // build-your-own site's zero-MUI census, which no page currently trips only
  // because no page turns on a colorBy that raises a legend. Same call
  // `BaseTooltip` made in 2026-08: what it needed was colors, and colors have a
  // toolkit-free home already. See DISPLAYCHROME.md, "a third seam was
  // considered for the tooltip and rejected".
  //
  // `×` is what `SvgColorLegend` already draws for this control, so the
  // exported legend and the on-screen one now agree.
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    font: 'inherit',
    lineHeight: 1,
    padding: '1px 3px',
    border: 0,
    background: 'none',
    color: theme.palette.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      color: theme.palette.text.primary,
    },
  },
  withClose: {
    paddingRight: 20,
  },
  topTitle: {
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    marginBottom: 2,
  },
  section: {
    '&:not(:last-child)': {
      marginBottom: 4,
    },
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
    marginBottom: 1,
    '&:last-child': {
      marginBottom: 0,
    },
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
    marginRight: 6,
    flexShrink: 0,
  },
  label: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // was `<Link component="button" underline="hover">`, which is the same
  // element with Material's typography on it — see `closeButton` above for why
  // that mattered
  toggle: {
    font: 'inherit',
    fontSize: 10,
    display: 'block',
    marginTop: 2,
    padding: 0,
    border: 0,
    background: 'none',
    textAlign: 'left',
    color: theme.palette.primary.main,
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}))

const DEFAULT_MAX_ITEMS = 12
const DEFAULT_MAX_WIDTH = 200

// Side of one mark. The old fixed color box's size, kept so a legend of plain
// fills is pixel-identical to what shipped before marks existed.
const SWATCH = 12

// The spec itself lives in core beside SvgColorLegend, so the export legends can
// flatten the very value this component renders (see legendEntries). Re-exported
// here because every display already imports it from this plugin.
export type {
  LegendItem,
  LegendMark,
  LegendSection,
  LegendSpec,
  LegendSwatch,
} from '@jbrowse/core/ui/legendSpec'

// One list of swatches with its own independent collapse state, so each section
// in a multi-section legend expands/collapses on its own.
const LegendItemList = observer(function LegendItemList({
  items,
  maxItems,
  onItemClick,
}: {
  items: LegendItem[]
  maxItems: number
  onItemClick?: (item: LegendItem) => void
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const collapsible = items.length > maxItems
  const shown = collapsible && !expanded ? items.slice(0, maxItems) : items
  const hiddenCount = items.length - maxItems
  // Every row reserves the widest row's swatch column, so labels stay in one
  // vertical line whether a row draws one mark or two — and so a color-less
  // heading row indents like the swatches it heads, as the fixed-size box it
  // replaces used to.
  const columns = Math.max(1, ...shown.map(i => legendSwatches(i).length))
  return (
    <>
      {shown.map((item, i) => {
        const row = (
          <>
            <div
              className={classes.swatches}
              style={{ minWidth: columns * SWATCH + (columns - 1) * 2 }}
            >
              {legendSwatches(item).map(swatch => (
                <svg
                  key={`${swatch.color}-${swatch.mark ?? 'fill'}`}
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
        return onItemClick ? (
          <button
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={`${item.label}-${i}`}
            type="button"
            className={cx(classes.item, classes.itemButton)}
            title="Show only these rows"
            onClick={() => {
              onItemClick(item)
            }}
          >
            {row}
          </button>
        ) : (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <div key={`${item.label}-${i}`} className={classes.item}>
            {row}
          </div>
        )
      })}
      {collapsible ? (
        <button
          type="button"
          className={classes.toggle}
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

// Floating color-key overlay. Pass a flat `items` list for a single scheme, or
// `sections` to show several titled, individually-closable panels in one box
// (e.g. genotype colors vs. sample-grouping colors on the multi-sample variant
// display). Section titles + per-section close buttons only appear when there
// is more than one section, so a single-scheme legend looks unchanged. `title`
// is a heading for the whole box, shown regardless of section count.
//
// `onItemClick` makes the rows act — for a key whose entries name groups of
// rows, clicking one focuses those rows. It is handed the section too, so a
// display with several vocabularies can act on the one that names rows and
// leave the others inert.
const FloatingLegend = observer(function FloatingLegend({
  items,
  sections,
  title,
  onDismiss,
  onDismissSection,
  onItemClick,
  maxItems = DEFAULT_MAX_ITEMS,
  maxWidth = DEFAULT_MAX_WIDTH,
  top = 10,
}: {
  items?: LegendItem[]
  sections?: LegendSection[]
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
  // Distance from the top of the display box. Raise it for a display that
  // already draws something in that corner — multi-wiggle's score legend is
  // pinned to the same right edge and drawn from y=0, so the two overprint at
  // the default. Every other display has the corner to itself and leaves this
  // alone.
  top?: number
}) {
  const { classes } = useStyles()

  const nonEmpty = nonEmptyLegendSections({ items, sections })
  if (nonEmpty.length === 0) {
    return null
  }

  const multiSection = nonEmpty.length > 1
  // portal above the inter-region padding masks so the key isn't buried at
  // whole-genome / multi-region scale (see TrackOverlayPortal)
  return (
    <TrackOverlayPortal>
      <div
        className={cx(classes.legend, onDismiss && classes.withClose)}
        style={{ top, maxWidth }}
        // Same doctrine as `plainChromeOverlays`' testids: a stable hook for the
        // harnesses that have to find this box. The build-your-own site's smoke
        // census needs it to prove the zero it reports for a page showing a
        // legend is a legend that rendered, rather than a legend that never
        // appeared — see `ultraminimal`'s unearned zero in that file.
        data-testid="floating-legend"
        // Claims the press, so a drag that starts on the key isn't the LGV's
        // click-drag pan (`useSideScroll` tests `closest('[data-gesture-owner]')`).
        // Without it, dragging across a label panned the view under the legend
        // and the `preventDefault` on each pan frame also meant the label text
        // could not be selected. The marker, not `stopPropagation`: the pan
        // reads `event.target` off a bubbling mousedown, and stopping that one
        // would also cost focus-on-click, whose document-level listener
        // (`useFocusOnInteraction`) React's stopPropagation does block.
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
        {title ? <div className={classes.topTitle}>{title}</div> : null}
        {nonEmpty.map(section => (
          <div key={section.id} className={classes.section}>
            {multiSection && section.title ? (
              <div className={classes.sectionHeader}>
                <span className={classes.sectionTitle}>{section.title}</span>
                {onDismissSection ? (
                  <Tooltip title={`Hide ${section.title}`}>
                    <button
                      type="button"
                      className={classes.sectionClose}
                      aria-label={`Hide ${section.title}`}
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
            <LegendItemList
              items={section.items}
              maxItems={maxItems}
              onItemClick={
                onItemClick
                  ? item => {
                      onItemClick(item, section)
                    }
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </TrackOverlayPortal>
  )
})

export default FloatingLegend
