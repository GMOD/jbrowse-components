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
import { countOfTotal, formatLenRange, supportLabel } from './tooltipUtils.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type {
  CoverageBin,
  InterbaseBin,
  TooltipPayload,
} from './tooltipUtils.ts'
import type { MouseState } from '@jbrowse/core/ui'
import type React from 'react'

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
  if (position === undefined) {
    return refName || ''
  }
  const pos = toLocale(position + 1)
  return refName ? `${refName}:${pos}` : pos
}

function SimpleTooltipContents({ message }: { message: string }) {
  return message ? <SanitizedHTML html={message} /> : null
}

// "18(+) 22(-)"
function strandCounts(fwd: number, rev: number) {
  return `${fwd}(+) ${rev}(-)`
}

function ColorSwatch({ color }: { color: string }) {
  return <div style={{ width: 10, height: 10, background: color }} />
}

// Mean per-read call probability for one modification tally.
function avgProbability(mod: { probabilityTotal: number; count: number }) {
  return mod.count > 0 ? mod.probabilityTotal / mod.count : 0
}

function InterbaseTooltip({
  interbaseData,
  total,
  location,
}: {
  interbaseData: InterbaseBin['interbase']
  total: number
  location: string
}) {
  const { classes } = useStyles()

  return (
    <table>
      <caption>Interbase - {location}</caption>
      <thead>
        <tr>
          <th>Type</th>
          <th>Reads</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total</td>
          <td>{total}</td>
          <td />
        </tr>
        {Object.entries(interbaseData).map(([type, data]) => (
          <tr key={type}>
            <td>
              {getCigarTypeLabel(type)}
              {data.topSeq && data.minLen <= 10
                ? ` (most frequent ${data.topSeq})`
                : null}
            </td>
            <td className={classes.td}>{countOfTotal(data.count, total)}</td>
            <td className={classes.td}>
              {data.minLen > 0 || data.maxLen > 0
                ? formatLenRange(data.minLen, data.maxLen)
                : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Which optional columns the coverage table is showing. Swatches whenever some
// row describes a coloured mark — an allele or a modification; Avg Prob only
// with modification data; Strands only when some row reports it. Both the header
// and every body row derive their cells from this one value, so a row can't fall
// out of column alignment by forgetting a filler <td>.
interface CoverageColumns {
  swatches: boolean
  avgProb: boolean
  strands: boolean
}

// One body row of the coverage table. Cells are named rather than positional,
// and the optional ones render as empty when this row has nothing for them.
function CoverageRow({
  columns,
  swatch,
  label,
  reads,
  avgProb,
  strands,
}: {
  columns: CoverageColumns
  swatch?: string
  label: React.ReactNode
  reads?: React.ReactNode
  avgProb?: React.ReactNode
  strands?: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <tr>
      {columns.swatches ? (
        <td>{swatch ? <ColorSwatch color={swatch} /> : null}</td>
      ) : null}
      <td>{label}</td>
      <td className={classes.td}>{reads}</td>
      {columns.avgProb ? <td>{avgProb}</td> : null}
      {columns.strands ? <td className={classes.td}>{strands}</td> : null}
    </tr>
  )
}

// Exported for its colocated test only — deliberately NOT re-exported from the
// plugin entry, since nothing outside this file renders it (MAF has its own).
export function CoverageTooltipContents({
  bin,
  refName,
  baseColors,
}: {
  bin: CoverageBin
  refName?: string
  // The 256-entry CSS table `buildBaseCssMap` builds for the mismatch draws, so
  // a row's swatch is the colour of the bar segment above the cursor by
  // construction rather than by a second spelling of the palette. Indexed by the
  // raw base byte, which is what carries the non-ACGTN fallback.
  baseColors: string[]
}) {
  const {
    position,
    depth,
    fwdDepth,
    revDepth,
    snps,
    deletions,
    modifications,
  } = bin
  const location = formatLocation(refName, position)

  // Descending by count, tie-broken by base. `Object.entries` is insertion
  // order and `countSnpsAtPosition` inserts in mismatch-array order, so the same
  // locus listed its alleles differently after a pan. Descending alone still
  // flips two alleles at equal depth, which is the pair a reader at a het site
  // is most likely to be staring at.
  const snpEntries = Object.entries(snps).sort(
    ([aBase, a], [bBase, b]) => b.count - a.count || aBase.localeCompare(bBase),
  )
  // Sort modifications by name for consistent display order
  const modEntries = modifications
    ? [...modifications].sort((a, b) => a.name.localeCompare(b.name))
    : []
  const hasTotalStrands = fwdDepth !== undefined && revDepth !== undefined
  const columns: CoverageColumns = {
    swatches: modEntries.length > 0 || snpEntries.length > 0,
    avgProb: modEntries.length > 0,
    strands:
      modEntries.length > 0 ||
      hasTotalStrands ||
      snpEntries.some(([, d]) => d.fwd > 0 || d.rev > 0),
  }

  // Reads carrying the reference allele. `depth` counts every read over the
  // position and `snps` holds mismatches only — a deleted base is in neither, an
  // insertion is interbase — so the difference is the count a reader at a het
  // site is after, and the table used to leave them to subtract it. Floored
  // because the two tallies come from different arrays.
  //
  // The BASE is deliberately absent: `regionSequence` is fetched only for
  // bisulfite colouring and never ships to the main thread, so this row is `Ref`
  // rather than `Ref (G)`. Only drawn where there is an alt to weigh it against.
  const altReads = snpEntries.reduce((sum, [, d]) => sum + d.count, 0)
  const refRow = snpEntries.length > 0 && {
    reads: Math.max(0, depth - altReads),
    fwd: Math.max(
      0,
      (fwdDepth ?? 0) - snpEntries.reduce((s, [, d]) => s + d.fwd, 0),
    ),
    rev: Math.max(
      0,
      (revDepth ?? 0) - snpEntries.reduce((s, [, d]) => s + d.rev, 0),
    ),
  }

  return (
    <table>
      <caption>Coverage - {location}</caption>
      <thead>
        <tr>
          {columns.swatches ? <th /> : null}
          <th>Base</th>
          <th>Reads</th>
          {columns.avgProb ? <th>Avg Prob</th> : null}
          {columns.strands ? <th>Strands</th> : null}
        </tr>
      </thead>
      <tbody>
        <CoverageRow
          columns={columns}
          label="Total"
          reads={depth}
          strands={
            hasTotalStrands ? strandCounts(fwdDepth, revDepth) : undefined
          }
        />
        {modEntries.map(data => (
          <CoverageRow
            key={`${data.name}-${data.color}`}
            columns={columns}
            swatch={data.color}
            label={data.name}
            reads={countOfTotal(data.count, depth)}
            avgProb={`${(avgProbability(data) * 100).toFixed(1)}%`}
            strands={strandCounts(data.fwd, data.rev)}
          />
        ))}
        {/* SNP rows sit alongside the modification rows rather than instead of
            them: at a CpG the A/C/G/T breakdown and the methylation calls are
            exactly the pair worth disambiguating, which is why the per-read
            modification tooltip carries its snpBase too. */}
        {refRow ? (
          <CoverageRow
            columns={columns}
            label="Ref"
            reads={countOfTotal(refRow.reads, depth)}
            strands={
              hasTotalStrands ? strandCounts(refRow.fwd, refRow.rev) : undefined
            }
          />
        ) : null}
        {snpEntries.map(([base, data]) => (
          <CoverageRow
            key={base}
            columns={columns}
            swatch={baseColors[base.toUpperCase().charCodeAt(0)]}
            label={base.toUpperCase()}
            reads={countOfTotal(data.count, depth)}
            strands={strandCounts(data.fwd, data.rev)}
          />
        ))}
        {deletions ? (
          // Deletions aren't in `depth` (a deleted base is absent from the
          // read), so their share is out of depth + deletions, not depth.
          <CoverageRow
            columns={columns}
            label={`Deletion (${formatLenRange(deletions.minLen, deletions.maxLen)})`}
            reads={countOfTotal(deletions.count, depth + deletions.count)}
          />
        ) : null}
      </tbody>
    </table>
  )
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
        <div className={classes.tooltipContent}>
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
              <InterbaseTooltip
                interbaseData={bin.interbase}
                total={bin.interbaseDepth}
                location={formatLocation(refName, bin.position)}
              />
            </div>
          </BaseTooltip>
          <CoverageHoverBar left={mouseState.x} band={hoverCoverageBand} />
        </>
      )
    }
    case 'coverage':
      return (
        <>
          <BaseTooltip clientPoint={{ x, y }}>
            <div className={classes.tooltipContent}>
              <CoverageTooltipContents
                bin={tooltipData.bin}
                refName={tooltipData.refName}
                baseColors={buildBaseCssMap({
                  colors: colorPalette,
                  showModifications,
                })}
              />
            </div>
          </BaseTooltip>
          <CoverageHoverBar left={mouseState.x} band={hoverCoverageBand} />
        </>
      )
    case 'sashimi': {
      const { start, end, score, strand, refName } = tooltipData
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
          </div>
        </BaseTooltip>
      )
    }
    case 'arc': {
      const { refName, endRefName, start, end, support, category, insertSize } =
        tooltipData
      return (
        <BaseTooltip clientPoint={{ x, y }}>
          <div className={classes.tooltipContent}>
            <div>
              <strong>
                {endRefName === undefined
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
            {endRefName === undefined ? (
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
  }
})

export default AlignmentsTooltip
