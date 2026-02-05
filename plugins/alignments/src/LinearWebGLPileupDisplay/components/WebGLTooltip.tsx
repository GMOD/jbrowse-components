import { forwardRef, isValidElement } from 'react'

import { toLocale } from '@jbrowse/core/util'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { CoverageTooltipBin } from '../../RenderWebGLPileupDataRPC/types'
import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  hoverVertical: {
    background: theme.palette.text.primary,
    border: 'none',
    width: 1,
    height: '100%',
    top: 0,
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

// Coverage tooltip contents similar to LinearSNPCoverageDisplay
const CoverageTooltipContents = forwardRef<
  HTMLDivElement,
  { bin: CoverageTooltipBin; refName?: string }
>(function CoverageTooltipContents2({ bin, refName }, ref) {
  const { position, depth, snps, delskips, interbase } = bin
  const location = refName
    ? `${refName}:${toLocale(position + 1)}`
    : toLocale(position + 1)

  const snpEntries = Object.entries(snps)
  const delskipEntries = Object.entries(delskips ?? {})
  const interbaseEntries = Object.entries(interbase)

  return (
    <div ref={ref}>
      <table>
        <caption>{location}</caption>
        <thead>
          <tr>
            <th>Type</th>
            <th>Count</th>
            <th>% of Reads</th>
            <th>Strands</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total</td>
            <td>{depth}</td>
            <td />
            <td />
            <td />
          </tr>
          {snpEntries.map(([base, data]) => (
            <tr key={base}>
              <td>{base}</td>
              <td>{data.count}</td>
              <td>{pct(data.count, depth)}</td>
              <td>
                {data.fwd}(+) {data.rev}(-)
              </td>
              <td />
            </tr>
          ))}
          {delskipEntries.map(([type, data]) => {
            const typeLabel = type === 'deletion' ? 'Deletion' : 'Skip/Intron'
            const sizeStr =
              data.minLen === data.maxLen
                ? `${data.minLen}bp`
                : `${data.minLen}-${data.maxLen}bp (avg ${data.avgLen.toFixed(1)}bp)`
            return (
              <tr key={type}>
                <td>{typeLabel}</td>
                <td>{data.count}</td>
                <td>{pct(data.count, depth)}</td>
                <td />
                <td>{sizeStr}</td>
              </tr>
            )
          })}
          {interbaseEntries.map(([type, data]) => {
            const typeLabel =
              type === 'insertion'
                ? 'Insertion'
                : type === 'softclip'
                  ? 'Soft clip'
                  : 'Hard clip'
            const sizeStr =
              data.minLen === data.maxLen
                ? `${data.minLen}bp`
                : `${data.minLen}-${data.maxLen}bp (avg ${data.avgLen.toFixed(1)}bp)`
            return (
              <tr key={type}>
                <td>{typeLabel}</td>
                <td>{data.count}</td>
                <td>{pct(data.count, depth)}</td>
                <td />
                <td>{sizeStr}</td>
              </tr>
            )
          })}
          {interbaseEntries.map(([type, data]) =>
            data.topSeq ? (
              <tr key={`${type}-seq`}>
                <td colSpan={5}>
                  Most common sequence:{' '}
                  {data.topSeq.length > 20
                    ? `${data.topSeq.slice(0, 20)}...`
                    : data.topSeq}
                </td>
              </tr>
            ) : null,
          )}
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
  bin: CoverageTooltipBin
  refName?: string
}

type TooltipDataType = CoverageTooltipData | IndicatorTooltipData | string

/**
 * Custom Tooltip for WebGL Pileup Display
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
  const x = clientMouseCoord[0] + 15
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

  // Coverage or indicator tooltip with flag-style display (vertical line indicator)
  if (
    tooltipData &&
    typeof tooltipData === 'object' &&
    (tooltipData.type === 'coverage' || tooltipData.type === 'indicator')
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
              height: showCoverage ? coverageHeight : height ?? 100,
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
