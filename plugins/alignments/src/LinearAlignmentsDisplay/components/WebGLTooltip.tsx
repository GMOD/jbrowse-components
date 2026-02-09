import { forwardRef, isValidElement } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import { getInterbaseTypeLabel } from '../../shared/types.ts'

import type { CoverageTooltipBin } from '../../RenderWebGLPileupDataRPC/types'
import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  hoverVertical: {
    background: theme.palette.text.primary,
    border: 'none',
    width: 1,
    height: '100%',
    top: YSCALEBAR_LABEL_OFFSET,
    cursor: 'default',
    position: 'absolute',
    pointerEvents: 'none',
  },
  td: {
    whiteSpace: 'nowrap',
  },
  interbaseContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5em',
  },
  interbaseTitle: {
    fontWeight: 600,
  },
  interbaseStat: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1em',
  },
}))

function pct(n: number, total = 1) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

function formatLocation(refName?: string, position?: number) {
  if (position === undefined) {
    return refName || ''
  }
  const pos = toLocale(position + 1)
  return refName ? `${refName}:${pos}` : pos
}

interface TooltipProps {
  message: React.ReactNode | string
}

const SimpleTooltipContents = forwardRef<HTMLDivElement, TooltipProps>(
  function SimpleTooltipContents2({ message }, ref) {
    return (
      <div ref={ref}>
        {isValidElement(message) ? (
          message
        ) : message ? (
          <div dangerouslySetInnerHTML={{ __html: String(message) }} />
        ) : null}
      </div>
    )
  },
)

// Interbase tooltip - minimal layout showing all interbase types at position
function InterbaseTooltip({
  interbaseData,
  total,
  location,
  tdClass,
}: {
  interbaseData: Record<
    string,
    {
      count: number
      minLen: number
      maxLen: number
      avgLen: number
      topSeq?: string
    }
  >
  total: number
  location: string
  tdClass: string
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.interbaseContainer}>
      <div className={classes.interbaseTitle}>Interbase events at {location}</div>

      {Object.entries(interbaseData).map(([type, data]) => {
        const sizeStr =
          data.minLen === data.maxLen
            ? `${data.minLen}bp`
            : `${data.minLen}-${data.maxLen}bp (avg ${data.avgLen.toFixed(1)}bp)`

        return (
          <div key={type}>
            <div style={{ fontWeight: 500 }}>
              {getInterbaseTypeLabel(type)}
            </div>
            <div className={classes.interbaseStat}>
              <span>Count:</span>
              <span>{data.count}</span>
            </div>
            <div className={classes.interbaseStat}>
              <span>% of Reads:</span>
              <span>{pct(data.count, total)}</span>
            </div>
            {(data.minLen > 0 || data.maxLen > 0) && (
              <div className={classes.interbaseStat}>
                <span>Size:</span>
                <span>{sizeStr}</span>
              </div>
            )}
            {data.topSeq && (
              <div style={{ marginTop: '0.25em' }}>
                Most common: {data.topSeq}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Coverage tooltip - matches LinearSNPCoverageDisplay/components/TooltipContents BinTooltip structure
const CoverageTooltipContents = forwardRef<
  HTMLDivElement,
  { bin: CoverageTooltipBin; refName?: string }
>(function CoverageTooltipContents2({ bin, refName }, ref) {
  const { classes } = useStyles()
  const { position, depth, snps, deletions, interbase, modifications } = bin
  const location = formatLocation(refName, position)

  const snpEntries = Object.entries(snps)
  const interbaseEntries = Object.entries(interbase)
  const modEntries = modifications ? Object.entries(modifications) : []
  const hasModifications = modEntries.length > 0

  return (
    <div ref={ref}>
      <table>
        <caption>{location}</caption>
        <thead>
          <tr>
            <th />
            <th>Base</th>
            <th># of Reads</th>
            <th>% of Reads</th>
            <th>Strands</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td />
            <td>Total</td>
            <td>{depth}</td>
            <td />
            <td />
          </tr>
          {hasModifications
            ? modEntries.map(([, data]) => (
                <tr key={data.name}>
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
                  <td className={classes.td}>{data.count}</td>
                  <td>{pct(data.count, depth)}</td>
                  <td>
                    {data.fwd}(+) {data.rev}(-)
                  </td>
                </tr>
              ))
            : snpEntries.map(([base, data]) => (
                <tr key={base}>
                  <td />
                  <td>{base.toUpperCase()}</td>
                  <td className={classes.td}>{data.count}</td>
                  <td>{pct(data.count, depth)}</td>
                  <td>
                    {data.fwd}(+) {data.rev}(-)
                  </td>
                </tr>
              ))}
          {deletions && (
            <tr>
              <td />
              <td>
                Deletion (
                {deletions.minLen === deletions.maxLen
                  ? `${deletions.minLen}bp`
                  : `${deletions.minLen}-${deletions.maxLen}bp`}
                )
              </td>
              <td className={classes.td}>{deletions.count}</td>
              <td>{pct(deletions.count, depth)}</td>
              <td />
            </tr>
          )}
          {interbaseEntries.map(([type, data]) => {
            const typeLabel = getInterbaseTypeLabel(type)
            const sizeStr =
              data.minLen === data.maxLen
                ? `${data.minLen}bp`
                : `${data.minLen}-${data.maxLen}bp`
            return (
              <tr key={type}>
                <td />
                <td>
                  {typeLabel} ({sizeStr})
                </td>
                <td className={classes.td}>{data.count}</td>
                <td>{pct(data.count, depth)}</td>
                <td />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

type Coord = [number, number]

// Parsed coverage tooltip data
interface CoverageTooltipData {
  type: 'coverage'
  bin: CoverageTooltipBin
  refName?: string
}

interface IndicatorTooltipData {
  type: 'indicator'
  indicatorType: string // 'insertion', 'softclip', 'hardclip'
  bin: CoverageTooltipBin
  refName?: string
}

interface SashimiTooltipData {
  type: 'sashimi'
  start: number
  end: number
  score: number
  strand: string
  refName: string
}

type TooltipDataType =
  | CoverageTooltipData
  | IndicatorTooltipData
  | SashimiTooltipData
  | string

/**
 * Custom Tooltip for LinearAlignmentsDisplay
 * Supports flag-style tooltip with vertical line indicator for coverage
 */
const WebGLTooltip = observer(function WebGLTooltip({
  model,
  height,
  clientMouseCoord,
  offsetMouseCoord,
}: {
  model: {
    featureUnderMouse: Feature | undefined
    featureIdUnderMouse: string | undefined
    mouseoverExtraInformation: string | undefined
    showCoverage: boolean
    coverageHeight: number
    loadedRegion: { refName: string } | null
  }
  height?: number
  offsetMouseCoord?: Coord
  clientMouseCoord: Coord
  clientRect?: DOMRect
  mouseCoord?: Coord
}) {
  const {
    featureUnderMouse,
    featureIdUnderMouse,
    mouseoverExtraInformation,
    showCoverage,
    coverageHeight,
  } = model
  const { classes } = useStyles()
  const x = clientMouseCoord[0] + 5
  const y = clientMouseCoord[1]

  // Try to parse structured tooltip data
  let tooltipData: TooltipDataType | undefined
  if (mouseoverExtraInformation) {
    try {
      tooltipData = JSON.parse(mouseoverExtraInformation)
    } catch {
      // Not JSON, treat as simple string
      tooltipData = mouseoverExtraInformation
    }
  }

  // Indicator tooltip - show all interbase events at position
  if (
    tooltipData &&
    typeof tooltipData === 'object' &&
    tooltipData.type === 'indicator'
  ) {
    const { bin, refName } = tooltipData
    if (Object.keys(bin.interbase).length > 0) {
      const location = formatLocation(refName, bin.position)
      return (
        <>
          <BaseTooltip clientPoint={{ x, y }}>
            <InterbaseTooltip
              interbaseData={bin.interbase}
              total={bin.depth}
              location={location}
              tdClass={classes.td}
            />
          </BaseTooltip>
          {offsetMouseCoord && (
            <div
              className={classes.hoverVertical}
              style={{
                left: offsetMouseCoord[0],
                height: showCoverage
                  ? coverageHeight - YSCALEBAR_LABEL_OFFSET * 2
                  : (height ?? 100),
              }}
            />
          )}
        </>
      )
    }
  }

  // Sashimi arc tooltip
  if (
    tooltipData &&
    typeof tooltipData === 'object' &&
    tooltipData.type === 'sashimi'
  ) {
    const { start, end, score, strand, refName } = tooltipData
    return (
      <BaseTooltip clientPoint={{ x, y }}>
        <div>
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

  // Coverage tooltip with flag-style display (vertical line indicator)
  if (
    tooltipData &&
    typeof tooltipData === 'object' &&
    tooltipData.type === 'coverage'
  ) {
    return (
      <>
        <BaseTooltip clientPoint={{ x, y }}>
          <CoverageTooltipContents
            bin={tooltipData.bin}
            refName={tooltipData.refName}
          />
        </BaseTooltip>
        {offsetMouseCoord && (
          <div
            className={classes.hoverVertical}
            style={{
              left: offsetMouseCoord[0],
              height: showCoverage
                ? coverageHeight - YSCALEBAR_LABEL_OFFSET * 2
                : (height ?? 100),
            }}
          />
        )}
      </>
    )
  }

  // Simple string tooltip (CIGAR items, features)
  if (!featureUnderMouse && mouseoverExtraInformation) {
    return (
      <BaseTooltip clientPoint={{ x, y }}>
        <SimpleTooltipContents message={mouseoverExtraInformation} />
      </BaseTooltip>
    )
  }

  // Feature tooltip with mouseoverExtraInformation
  if (featureIdUnderMouse && mouseoverExtraInformation) {
    return (
      <BaseTooltip clientPoint={{ x, y }}>
        <SimpleTooltipContents message={mouseoverExtraInformation} />
      </BaseTooltip>
    )
  }

  return null
})

export default WebGLTooltip
