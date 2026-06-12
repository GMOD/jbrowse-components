import { isValidElement } from 'react'

import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import { SanitizedHTML } from '@jbrowse/core/ui'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { pct } from './tooltipUtils.ts'
import { getModificationName } from '../../shared/modificationData.ts'
import { getInterbaseTypeLabel } from '../../shared/types.ts'

import type { TooltipPayload } from './tooltipUtils.ts'
import type { CoverageTooltipBin } from '@jbrowse/alignments-core'

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
        height: band.coverageHeight - YSCALEBAR_LABEL_OFFSET * 2,
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

function SimpleTooltipContents({
  message,
}: {
  message: React.ReactNode | string
}) {
  return isValidElement(message) ? (
    message
  ) : message ? (
    <SanitizedHTML html={message} />
  ) : null
}

function InterbaseTooltip({
  interbaseData,
  total,
  location,
}: {
  interbaseData: Record<
    string,
    {
      count: number
      minLen: number
      maxLen: number
      avgLen: number
      topSeq?: string
      topSeqCount?: number
    }
  >
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
        {Object.entries(interbaseData).map(([type, data]) => {
          const sizeStr =
            data.minLen === data.maxLen
              ? `${data.minLen}bp`
              : `${data.minLen}-${data.maxLen}bp`

          return (
            <tr key={type}>
              <td>
                {getInterbaseTypeLabel(type)}
                {data.topSeq && data.minLen <= 10
                  ? ` (most frequent ${data.topSeq})`
                  : null}
              </td>
              <td className={classes.td}>
                {data.count}/{total} ({pct(data.count, total)})
              </td>
              <td className={classes.td}>
                {data.minLen > 0 || data.maxLen > 0 ? sizeStr : null}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function CoverageTooltipContents({
  bin,
  refName,
}: {
  bin: CoverageTooltipBin
  refName?: string
}) {
  const { classes } = useStyles()
  const {
    position,
    depth,
    interbaseDepth,
    snps,
    deletions,
    interbase,
    modifications,
  } = bin
  const location = formatLocation(refName, position)

  const snpEntries = Object.entries(snps)
  const interbaseEntries = Object.entries(interbase)
  // Sort modifications by name for consistent display order
  const modEntries = modifications
    ? Object.entries(modifications).sort((a, b) =>
        a[1].name.localeCompare(b[1].name),
      )
    : []
  const hasModifications = modEntries.length > 0
  const hasStrands =
    hasModifications || snpEntries.some(([, d]) => d.fwd > 0 || d.rev > 0)

  return (
    <table>
      <caption>Coverage - {location}</caption>
      <thead>
        <tr>
          {hasModifications && <th />}
          <th>Base</th>
          <th>Reads</th>
          {hasModifications && <th>Avg Prob</th>}
          {hasStrands && <th>Strands</th>}
        </tr>
      </thead>
      <tbody>
        <tr>
          {hasModifications && <td />}
          <td>Total</td>
          <td>{depth}</td>
          {hasModifications && <td />}
          {hasStrands && <td />}
        </tr>
        {hasModifications
          ? modEntries.map(([modKey, data]) => {
              const avgProb =
                data.count > 0 ? data.probabilityTotal / data.count : 0
              return (
                <tr key={modKey}>
                  <td>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        background: data.color,
                      }}
                    />
                  </td>
                  <td>{data.name}</td>
                  <td className={classes.td}>
                    {data.count}/{depth} ({pct(data.count, depth)})
                  </td>
                  <td>{(avgProb * 100).toFixed(1)}%</td>
                  <td>
                    {data.fwd}(+) {data.rev}(-)
                  </td>
                </tr>
              )
            })
          : snpEntries.map(([base, data]) => (
              <tr key={base}>
                <td>{base.toUpperCase()}</td>
                <td className={classes.td}>
                  {data.count}/{depth} ({pct(data.count, depth)})
                </td>
                {hasStrands && (
                  <td>
                    {data.fwd}(+) {data.rev}(-)
                  </td>
                )}
              </tr>
            ))}
        {deletions && (
          <tr>
            {hasModifications && <td />}
            <td>
              Deletion (
              {deletions.minLen === deletions.maxLen
                ? `${deletions.minLen}bp`
                : `${deletions.minLen}-${deletions.maxLen}bp`}
              )
            </td>
            <td className={classes.td}>
              {deletions.count}/{depth + deletions.count} (
              {pct(deletions.count, depth + deletions.count)})
            </td>
            {hasModifications && <td />}
            <td />
          </tr>
        )}
        {interbaseEntries.map(([type, data]) => {
          const typeLabel = getInterbaseTypeLabel(type)
          const sizeStr =
            data.minLen === data.maxLen
              ? `${data.minLen}bp`
              : `${data.minLen}-${data.maxLen}bp`
          const shouldShowSeq = data.topSeq && data.minLen <= 10

          return (
            <tr key={type}>
              {hasModifications && <td />}
              <td>
                {typeLabel} ({sizeStr})
                {shouldShowSeq ? ` (most frequent ${data.topSeq})` : null}
              </td>
              <td className={classes.td}>
                {data.count}/{interbaseDepth} ({pct(data.count, interbaseDepth)}
                )
              </td>
              {hasModifications && <td />}
              <td />
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

type Coord = [number, number]

/**
 * Custom Tooltip for LinearAlignmentsDisplay
 * Supports flag-style tooltip with vertical line indicator for coverage
 */
const AlignmentsTooltip = observer(function AlignmentsTooltip({
  model,
  clientMouseCoord,
  offsetMouseCoord,
}: {
  model: {
    mouseoverExtraInformation: TooltipPayload | undefined
    hoverCoverageBand: { topOffset: number; coverageHeight: number } | undefined
  }
  offsetMouseCoord?: Coord
  clientMouseCoord: Coord
}) {
  const { mouseoverExtraInformation: tooltipData, hoverCoverageBand } = model
  const { classes } = useStyles()
  const x = clientMouseCoord[0] + 5
  const y = clientMouseCoord[1]

  if (tooltipData === undefined) {
    return null
  }

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
      const { bin, refName } = tooltipData
      if (Object.keys(bin.interbase).length === 0) {
        return null
      }
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
            left={offsetMouseCoord?.[0]}
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
            left={offsetMouseCoord?.[0]}
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
            <div>
              Location: {refName}:{toLocale(start)}-{toLocale(end)}
            </div>
            <div>Length: {toLocale(end - start)} bp</div>
            <div>Reads supporting junction: {score}</div>
            <div>Strand: {strand}</div>
          </div>
        </BaseTooltip>
      )
    }
    case 'modification': {
      const { modType, probability, color, refName, position, snpBase } =
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
                  <td>{modType ? getModificationName(modType) : 'Unknown'}</td>
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
