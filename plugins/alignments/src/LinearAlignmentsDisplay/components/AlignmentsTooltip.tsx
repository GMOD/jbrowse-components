import { formatBandLocation } from '@jbrowse/alignments-core'
import {
  CoverageTooltipTable,
  InterbaseTooltipTable,
} from '@jbrowse/alignments-core/CoverageTooltipTables'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { observer } from 'mobx-react'

import { buildBaseCssMap } from '../../features/mismatch/baseColors.ts'
import { formatLocationRange } from '../../shared/locStrings.ts'
import { getModificationCallName } from '../../shared/modificationData.ts'
import { getCigarTypeLabel } from '../../shared/types.ts'
import { supportLabel } from './tooltipUtils.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { TooltipPayload } from './tooltipUtils.ts'
import type { MouseState } from '@jbrowse/core/ui'

const useStyles = makeStyles()(theme => ({
  hoverVertical: {
    background: theme.palette.text.primary,
    border: 'none',
    width: 1,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
  td: {
    whiteSpace: 'nowrap',
  },
  tooltipContent: {
    fontSize: theme.typography.fontSize * 0.85,
    '& table': {
      borderCollapse: 'collapse',
    },
    '& td, & th': {
      border: '1px solid rgba(255,255,255,0.3)',
      padding: '2px 4px',
    },
  },
}))

// Vertical bar spanning the hovered section's coverage band. Grouped mode
// stacks many coverage bands, so the bar anchors to the section the cursor is
// over (via `band`), not always the top one. Only the coverage/indicator
// tooltips render it, and both fire only with coverage shown, so `band` is
// always set when those tooltips appear.
function CoverageHoverBar({
  left,
  band,
}: {
  left?: number
  band?: { topOffset: number; coverageHeight: number }
}) {
  const { classes } = useStyles()
  return left !== undefined && band ? (
    <div
      className={classes.hoverVertical}
      style={{
        left,
        top: band.topOffset + YSCALEBAR_LABEL_OFFSET,
        // A coverage band configured shorter than the two label offsets it
        // reserves would compute a negative height, which the browser drops —
        // the bar silently disappeared instead of collapsing to nothing.
        height: Math.max(0, band.coverageHeight - YSCALEBAR_LABEL_OFFSET * 2),
      }}
    />
  ) : null
}

function formatLocation(refName?: string, position?: number) {
  return position === undefined
    ? refName || ''
    : formatBandLocation(refName, position)
}

function SimpleTooltipContents({ message }: { message: string }) {
  return message ? <SanitizedHTML html={message} /> : null
}

/**
 * Custom Tooltip for LinearAlignmentsDisplay
 * Supports flag-style tooltip with vertical line indicator for coverage
 */
const AlignmentsTooltip = observer(function AlignmentsTooltip({
  model,
  mouseState,
}: {
  model: {
    mouseoverExtraInformation: TooltipPayload | undefined
    hoverCoverageBand: { topOffset: number; coverageHeight: number } | undefined
    colorPalette: ColorPalette
    showModifications: boolean
  }
  mouseState: MouseState | undefined
}) {
  const {
    mouseoverExtraInformation: tooltipData,
    hoverCoverageBand,
    colorPalette,
    showModifications,
  } = model
  const { classes } = useStyles()

  if (tooltipData === undefined || mouseState === undefined) {
    return null
  }
  const x = mouseState.clientX
  const y = mouseState.clientY

  if (typeof tooltipData === 'string') {
    return (
      <BaseTooltip clientPoint={{ x, y }}>
        <div className={classes.tooltipContent} data-testid="pileup-tooltip">
          <SimpleTooltipContents message={tooltipData} />
        </div>
      </BaseTooltip>
    )
  }

  switch (tooltipData.type) {
    case 'indicator': {
      // formatIndicatorTooltip only builds a payload when there are interbase
      // events, so the table always has rows.
      const { bin, refName } = tooltipData
      return (
        <>
          <BaseTooltip clientPoint={{ x, y }}>
            <div className={classes.tooltipContent}>
              <InterbaseTooltipTable
                interbase={bin.interbase}
                total={bin.interbaseDepth}
                location={formatBandLocation(refName, bin.position)}
                typeLabel={getCigarTypeLabel}
              />
            </div>
          </BaseTooltip>
          <CoverageHoverBar left={mouseState.x} band={hoverCoverageBand} />
        </>
      )
    }
    case 'coverage': {
      // The 256-entry CSS table `buildBaseCssMap` builds for the mismatch
      // draws, so a row's swatch is the colour of the bar segment above the
      // cursor by construction rather than by a second spelling of the palette.
      const baseColors = buildBaseCssMap({
        colors: colorPalette,
        showModifications,
      })
      return (
        <>
          <BaseTooltip clientPoint={{ x, y }}>
            <div className={classes.tooltipContent}>
              <CoverageTooltipTable
                bin={tooltipData.bin}
                location={formatBandLocation(
                  tooltipData.refName,
                  tooltipData.bin.position,
                )}
                swatchFor={base => baseColors[base.toUpperCase().charCodeAt(0)]}
              />
            </div>
          </BaseTooltip>
          <CoverageHoverBar left={mouseState.x} band={hoverCoverageBand} />
        </>
      )
    }
    case 'sashimi': {
      const { start, end, score, strand, refName, motif } = tooltipData
      return (
        <BaseTooltip clientPoint={{ x, y }}>
          <div className={classes.tooltipContent}>
            <div>
              <strong>Intron/Skip</strong>
            </div>
            <div>Location: {formatLocationRange(refName, start, end)}</div>
            <div>Length: {toLocale(end - start)} bp</div>
            <div>Reads supporting junction: {score}</div>
            <div>Strand: {strand}</div>
            {motif ? <div>Splice motif: {motif}</div> : null}
          </div>
        </BaseTooltip>
      )
    }
    case 'arc': {
      const {
        refName,
        endRefName,
        start,
        end,
        support,
        category,
        insertSize,
        unplacedPartnerBp,
      } = tooltipData
      return (
        <BaseTooltip clientPoint={{ x, y }}>
          <div className={classes.tooltipContent}>
            <div>
              <strong>
                {unplacedPartnerBp !== undefined
                  ? 'Read connection, partner off screen'
                  : endRefName === undefined
                    ? 'Read connection'
                    : 'Translocation connection'}
              </strong>
            </div>
            {/* Two POSITIONS across chromosomes, one RANGE within one. A range
                between two chromosomes reads as a locstring naming the first
                and a coordinate belonging to the second, and the distance below
                it is a subtraction of two unrelated number lines — which is the
                same reason `resolveArcs` refuses to colour these by insert size
                or orientation. */}
            {/* An unplaced mark has ONE end. Its two feet are collapsed onto
                the coordinate the view can place, so the range and the distance
                between them would read as a zero-width location over a partner
                that may be megabases away — the distance is reported instead. */}
            {unplacedPartnerBp !== undefined ? (
              <>
                <div>Location: {formatLocation(refName, start)}</div>
                <div>
                  Partner is {toLocale(unplacedPartnerBp)} bp away, outside the
                  loaded regions
                </div>
              </>
            ) : endRefName === undefined ? (
              <>
                <div>Location: {formatLocationRange(refName, start, end)}</div>
                <div>Distance: {toLocale(end - start)} bp</div>
              </>
            ) : (
              <div>
                Location: {formatLocation(refName, start)} ↔{' '}
                {formatLocation(endRefName, end)}
              </div>
            )}
            {/* The count `resolveArcs` folded into this arc, which is what its
                stroke width encodes. */}
            <div>{supportLabel(support)}</div>
            {insertSize === undefined ? null : (
              <div>Insert size: {toLocale(insertSize)} bp</div>
            )}
            {category === undefined ? null : <div>Type: {category}</div>}
          </div>
        </BaseTooltip>
      )
    }
    case 'arcLine': {
      const { refName, position, partnerRefNames, support, partnerOffView } =
        tooltipData
      return (
        <BaseTooltip clientPoint={{ x, y }}>
          <div className={classes.tooltipContent}>
            <div>
              <strong>Translocation breakpoint</strong>
            </div>
            <div>Location: {formatLocation(refName, position)}</div>
            {/* The one thing the mark itself cannot show. A tick is a bare
                vertical at a locus: without this the reader can see THAT the
                reads here have mates elsewhere and not where elsewhere is.
                Dropped entirely when the list is empty rather than printing a
                label with nothing after it — `resolveArcs` always fills it, but
                the hit test defaults it, so the empty case is reachable by a
                type rather than by a feed. */}
            {partnerRefNames.length === 0 ? null : (
              <div>
                {partnerRefNames.length === 1
                  ? 'Mate chromosome: '
                  : 'Mate chromosomes: '}
                {partnerRefNames.join(', ')}
              </div>
            )}
            {/* Why this is a tick and not an arc. Naming the mate chromosome
                is the whole content of the mark, and it is actively misleading
                when that chromosome is on screen: the reader looks across,
                sees arcs landing in the partner window, and cannot tell that
                these reads land outside it. See `partnerOffView` for why the
                claim is safe to make unconditionally in arc mode. */}
            {partnerOffView ? <div>Outside the displayed regions</div> : null}
            <div>{supportLabel(support)}</div>
          </div>
        </BaseTooltip>
      )
    }
    case 'modification': {
      const { modType, noMod, probability, color, refName, position, snpBase } =
        tooltipData
      return (
        <BaseTooltip clientPoint={{ x, y }}>
          <div className={classes.tooltipContent}>
            <table>
              <caption>
                Modification - {formatLocation(refName, position)}
              </caption>
              <tbody>
                <tr>
                  <td>
                    <div style={{ width: 10, height: 10, background: color }} />
                  </td>
                  <td>
                    {modType
                      ? getModificationCallName(modType, noMod)
                      : 'Unknown'}
                  </td>
                </tr>
                <tr>
                  <td>Probability</td>
                  <td className={classes.td}>
                    {(probability * 100).toFixed(1)}%
                  </td>
                </tr>
                {snpBase && (
                  <tr>
                    <td>SNP base</td>
                    <td className={classes.td}>{snpBase}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </BaseTooltip>
      )
    }
    default: {
      const unhandled: never = tooltipData
      return unhandled
    }
  }
})

export default AlignmentsTooltip
