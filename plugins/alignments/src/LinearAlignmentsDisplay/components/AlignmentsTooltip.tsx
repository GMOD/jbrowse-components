import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { formatLocationRange } from '../../shared/locStrings.ts'
import { getModificationCallName } from '../../shared/modificationData.ts'
import { getCigarTypeLabel } from '../../shared/types.ts'
import { countOfTotal, formatLenRange } from './tooltipUtils.ts'

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

// Which optional columns the coverage table is showing. The swatch and Avg Prob
// columns exist only with modification data; Strands only when some row reports
// it. Both the header and every body row derive their cells from this one value,
// so a row can't fall out of column alignment by forgetting a filler <td>.
interface CoverageColumns {
  modifications: boolean
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
      {columns.modifications ? (
        <td>{swatch ? <ColorSwatch color={swatch} /> : null}</td>
      ) : null}
      <td>{label}</td>
      <td className={classes.td}>{reads}</td>
      {columns.modifications ? <td>{avgProb}</td> : null}
      {columns.strands ? <td className={classes.td}>{strands}</td> : null}
    </tr>
  )
}

// Exported for its colocated test only — deliberately NOT re-exported from the
// plugin entry, since nothing outside this file renders it (MAF has its own).
export function CoverageTooltipContents({
  bin,
  refName,
}: {
  bin: CoverageBin
  refName?: string
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

  const snpEntries = Object.entries(snps)
  // Sort modifications by name for consistent display order
  const modEntries = modifications
    ? [...modifications].sort((a, b) => a.name.localeCompare(b.name))
    : []
  const hasTotalStrands = fwdDepth !== undefined && revDepth !== undefined
  const columns: CoverageColumns = {
    modifications: modEntries.length > 0,
    strands:
      modEntries.length > 0 ||
      hasTotalStrands ||
      snpEntries.some(([, d]) => d.fwd > 0 || d.rev > 0),
  }

  return (
    <table>
      <caption>Coverage - {location}</caption>
      <thead>
        <tr>
          {columns.modifications ? <th /> : null}
          <th>Base</th>
          <th>Reads</th>
          {columns.modifications ? <th>Avg Prob</th> : null}
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
        {snpEntries.map(([base, data]) => (
          <CoverageRow
            key={base}
            columns={columns}
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
  }
  mouseState: MouseState | undefined
}) {
  const { mouseoverExtraInformation: tooltipData, hoverCoverageBand } = model
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
          <CoverageHoverBar
            left={mouseState.x}
            band={hoverCoverageBand}
          />
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
              />
            </div>
          </BaseTooltip>
          <CoverageHoverBar
            left={mouseState.x}
            band={hoverCoverageBand}
          />
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
