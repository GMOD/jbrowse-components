import { useState } from 'react'

import { nonEmptyLegendSections } from '@jbrowse/core/ui'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { TrackOverlayPortal } from '../../LinearGenomeView/TrackOverlayPortal.tsx'

import type { LegendItem, LegendSection } from '@jbrowse/core/ui'

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
    maxWidth: 200,
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
  colorBox: {
    width: 12,
    height: 12,
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

// The spec itself lives in core beside SvgColorLegend, so the export legends can
// flatten the very value this component renders (see legendEntries). Re-exported
// here because every display already imports it from this plugin.
export type { LegendItem, LegendSection, LegendSpec } from '@jbrowse/core/ui'

// One list of swatches with its own independent collapse state, so each section
// in a multi-section legend expands/collapses on its own.
const LegendItemList = observer(function LegendItemList({
  items,
  maxItems,
}: {
  items: LegendItem[]
  maxItems: number
}) {
  const { classes } = useStyles()
  const [expanded, setExpanded] = useState(false)
  const collapsible = items.length > maxItems
  const shown = collapsible && !expanded ? items.slice(0, maxItems) : items
  const hiddenCount = items.length - maxItems
  return (
    <>
      {shown.map((item, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <div key={`${item.label}-${i}`} className={classes.item}>
          <div
            className={classes.colorBox}
            style={{ backgroundColor: item.color }}
          />
          <span className={classes.label}>{item.label}</span>
        </div>
      ))}
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
const FloatingLegend = observer(function FloatingLegend({
  items,
  sections,
  title,
  onDismiss,
  onDismissSection,
  maxItems = DEFAULT_MAX_ITEMS,
  top = 10,
}: {
  items?: LegendItem[]
  sections?: LegendSection[]
  title?: string
  onDismiss?: () => void
  onDismissSection?: (id: string) => void
  maxItems?: number
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
        style={{ top }}
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
          <button
            type="button"
            className={classes.closeButton}
            title="Hide legend"
            onClick={() => {
              onDismiss()
            }}
          >
            ×
          </button>
        ) : null}
        {title ? <div className={classes.topTitle}>{title}</div> : null}
        {nonEmpty.map(section => (
          <div key={section.id} className={classes.section}>
            {multiSection && section.title ? (
              <div className={classes.sectionHeader}>
                <span className={classes.sectionTitle}>{section.title}</span>
                {onDismissSection ? (
                  <button
                    type="button"
                    className={classes.sectionClose}
                    title={`Hide ${section.title}`}
                    onClick={() => {
                      onDismissSection(section.id)
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ) : null}
            <LegendItemList items={section.items} maxItems={maxItems} />
          </div>
        ))}
      </div>
    </TrackOverlayPortal>
  )
})

export default FloatingLegend
