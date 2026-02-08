import { forwardRef, isValidElement } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/plugin-wiggle'
import { observer } from 'mobx-react'

import { getInterbaseTypeLabel } from '../../SNPCoverageRenderer/types.ts'

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

// Interbase tooltip - matches LinearSNPCoverageDisplay/components/TooltipContents InterbaseTooltip
function InterbaseTooltip({
  type,
  count,
  total,
  minLen,
  maxLen,
  avgLen,
  topSeq,
  location,
  tdClass,
  reactRef,
}: {
  type: string
  count: number
  total: number
  minLen: number
  maxLen: number
  avgLen: number
  topSeq?: string
  location: string
  tdClass: string
  reactRef: React.Ref<HTMLDivElement>
}) {
  const sizeStr =
    minLen === maxLen
      ? `${minLen}bp`
      : `${minLen}-${maxLen}bp (avg ${avgLen.toFixed(1)}bp)`

  return (
    <div ref={reactRef}>
      <table>
        <caption>{location}</caption>
        <thead>
          <tr>
            <th>Type</th>
            <th>Count</th>
            <th>% of Reads</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{getInterbaseTypeLabel(type)}</td>
            <td className={tdClass}>{count}</td>
            <td>{pct(count, total)}</td>
            <td>{sizeStr}</td>
          </tr>
          {topSeq ? (
            <tr>
              <td colSpan={4}>
                Most common sequence:{' '}
                {topSeq.length > 20 ? `${topSeq.slice(0, 20)}...` : topSeq}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

// Coverage tooltip - matches LinearSNPCoverageDisplay/components/TooltipContents BinTooltip structure
const CoverageTooltipContents = forwardRef<
  HTMLDivElement,
  { bin: CoverageTooltipBin; refName?: string }
>(function CoverageTooltipContents2({ bin, refName }, ref) {
  const { classes } = useStyles()
  const { position, depth, snps, delskips, interbase } = bin
  const location = formatLocation(refName, position)

  const snpEntries = Object.entries(snps)
  const delskipEntries = Object.entries(delskips)
  const interbaseEntries = Object.entries(interbase)

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
          {snpEntries.map(([base, data]) => (
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
          {delskipEntries.map(([type, data]) => {
            const typeLabel = type === 'deletion' ? 'Deletion' : 'Skip/Intron'
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

type TooltipDataType = CoverageTooltipData | IndicatorTooltipData | string

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

  // Indicator tooltip - show focused interbase item
  if (
    tooltipData &&
    typeof tooltipData === 'object' &&
    tooltipData.type === 'indicator'
  ) {
    const { indicatorType, bin, refName } = tooltipData
    const interbaseData = bin.interbase[indicatorType]
    if (interbaseData) {
      const location = formatLocation(refName, bin.position)
      return (
        <>
          <BaseTooltip clientPoint={{ x, y }}>
            <InterbaseTooltip
              type={indicatorType}
              count={interbaseData.count}
              total={bin.depth}
              minLen={interbaseData.minLen}
              maxLen={interbaseData.maxLen}
              avgLen={interbaseData.avgLen}
              topSeq={interbaseData.topSeq}
              location={location}
              tdClass={classes.td}
              reactRef={null}
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
