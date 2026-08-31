import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { IconButton, Tooltip, useTheme } from '@mui/material'

import {
  colorByFallbackNote,
  colorByShortLabel,
  getColorBySwatch,
} from './colorLegend.ts'
import { legendChipColor } from './colorUtils.ts'

import type { CigarOpMask, ColorChip } from './colorLegend.ts'
import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyColorBy } from './colorUtils.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    position: 'absolute',
    top: 4,
    right: 4,
    // above the views' canvas overlays, which sit at 100 and would otherwise
    // paint the plot data over the legend
    zIndex: 200,
    pointerEvents: 'auto',
    padding: '2px 2px 4px 6px',
    borderRadius: 4,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    opacity: 0.9,
    // Material's elevation-2 shadow, spelled out: the legend floats over a
    // canvas and needs to read as a raised surface
    boxShadow:
      '0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)',
    fontSize: '0.7rem',
    // the box is shrink-to-fit, so without a floor the ramp collapses to
    // whatever the title row leaves over; a floor here rather than a width on
    // the bar keeps the bar shrinkable, so it can never overflow the border
    minWidth: 130,
    maxWidth: 200,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  title: {
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  close: {
    padding: 1,
  },
  ramp: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingRight: 4,
  },
  bar: {
    flex: 1,
    height: 10,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
  },
  domainLabel: {
    fontSize: '0.62rem',
    opacity: 0.8,
    whiteSpace: 'nowrap',
  },
  note: {
    fontSize: '0.62rem',
    opacity: 0.8,
    paddingRight: 4,
  },
  chips: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginTop: 2,
    paddingRight: 4,
  },
  chipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.62rem',
    overflow: 'hidden',
  },
  chipBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
    flexShrink: 0,
    border: `1px solid ${theme.palette.divider}`,
  },
  // Track names are arbitrarily long and the box is capped at 200px, so the
  // label has to give rather than spill past the border. minWidth:0 is the
  // load-bearing part — a flex item's default min-width:auto floors it at its
  // content width, so the ellipsis never engages and the text just overflows.
  chipLabel: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

// Floating, dismissible legend for the active color-by mode. Presentational —
// the plugin gates visibility on its own model flag and supplies onClose.
export function ColorByLegend({
  colorBy,
  pointBased = false,
  cigarOps,
  attributeRanges,
  alpha = 1,
  trackChips,
  onClose,
}: {
  // undefined when overlaid tracks are on different modes; the legend then
  // titles itself "Mixed" and lists the tracks rather than naming one mode
  colorBy: SyntenyColorBy | undefined
  // dotplot draws flat points, never CIGAR ops
  pointBased?: boolean
  // bitmask of indel ops actually drawn on screen; the ribbon view passes its
  // model-derived mask so the legend only lists indels the eye can find
  cigarOps?: CigarOpMask
  /** observed span per attribute, which labels an attribute mode's ramp */
  attributeRanges?: Record<string, AttributeRange>
  // the view's global ribbon alpha — chips are blended over the band's ground by
  // it so the key matches the on-screen (alpha-composited) ribbon colors,
  // subject to legendChipColor's legibility floor
  alpha?: number
  // one chip per overlaid track, for colorBy:'track' — the view supplies these
  trackChips?: ColorChip[]
  onClose: () => void
}) {
  const { classes } = useStyles()
  // The ground the chips are blended over: the same `background.paper` the
  // synteny band is cleared to (`bandGroundColor`), which is what the chips are
  // matching. Read here rather than passed in — the legend floats over that band
  // in both views that mount it.
  const groundColor = useTheme().palette.background.paper
  const swatch =
    colorBy === undefined
      ? ({ kind: 'chips', chips: trackChips ?? [] } as const)
      : getColorBySwatch(colorBy, {
          pointBased,
          cigarOps,
          trackChips,
          attributeRanges,
        })
  const title = colorBy === undefined ? 'Mixed' : colorByShortLabel(colorBy)
  return (
    <div className={classes.root} data-testid="color-by-legend">
      <div className={classes.header}>
        <span className={classes.title}>{title}</span>
        <Tooltip title="Hide legend">
          <IconButton
            className={classes.close}
            size="small"
            data-testid="color-by-legend-close"
            onClick={() => {
              onClose()
            }}
          >
            <CloseIcon style={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </div>
      {swatch?.kind === 'ramp' ? (
        <div className={classes.ramp}>
          <span className={classes.domainLabel}>{swatch.minLabel}</span>
          <span
            className={classes.bar}
            style={{ background: swatch.background }}
          />
          <span className={classes.domainLabel}>{swatch.maxLabel}</span>
        </div>
      ) : null}
      {swatch?.kind === 'chips' ? (
        <div className={classes.chips}>
          {swatch.chips.map(chip => (
            <span key={chip.label} className={classes.chipRow}>
              <span
                className={classes.chipBox}
                style={{
                  background:
                    chip.color === undefined
                      ? 'transparent'
                      : legendChipColor(chip.color, alpha, groundColor),
                }}
              />
              <span className={classes.chipLabel} title={chip.label}>
                {chip.label}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      {swatch || colorBy === undefined ? null : (
        <div className={classes.note}>{colorByFallbackNote(colorBy)}</div>
      )}
    </div>
  )
}
