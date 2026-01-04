import { forwardRef } from 'react'

import { reducePrecision, toLocale } from '@jbrowse/core/util'

import { getInterbaseTypeLabel } from '../../SNPCoverageRenderer/types'
import { formatStrandCounts, pct, useTooltipStyles } from './tooltipUtils'

import type { ClickMapItem } from '../../SNPCoverageRenderer/types'

interface Props {
  item: ClickMapItem
  refName?: string
}

const FlatbushTooltipContents = forwardRef<HTMLDivElement, Props>(
  function FlatbushTooltipContents2({ item, refName }, ref) {
    const { classes } = useTooltipStyles()
    const pos = toLocale(item.start + 1)
    const location = refName ? `${refName}:${pos}` : pos

    if (item.type === 'snp' && item.bin) {
      const { readsCounted, ref: refCounts, snps, mods, refbase } = item.bin
      return (
        <div ref={ref}>
          <table>
            <caption>{location}</caption>
            <thead>
              <tr>
                <th>Base</th>
                <th>Count</th>
                <th>% of Reads</th>
                <th>Strands</th>
                <th>Qual/Prob</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total</td>
                <td>{readsCounted}</td>
                <td>-</td>
                <td>-</td>
                <td />
              </tr>
              <tr>
                <td>
                  REF {refbase ? `(${refbase.toUpperCase()})` : ''}
                </td>
                <td className={classes.td}>{refCounts.entryDepth}</td>
                <td>{pct(refCounts.entryDepth, readsCounted)}</td>
                <td>{formatStrandCounts(refCounts)}</td>
                <td />
              </tr>
              {Object.entries(snps).map(([snpBase, entry]) => (
                <tr key={snpBase}>
                  <td>{snpBase.toUpperCase()}</td>
                  <td className={classes.td}>{entry.entryDepth}</td>
                  <td>{pct(entry.entryDepth, readsCounted)}</td>
                  <td>{formatStrandCounts(entry)}</td>
                  <td>
                    {entry.avgProbability !== undefined
                      ? `qual:${reducePrecision(entry.avgProbability)}`
                      : ''}
                  </td>
                </tr>
              ))}
              {Object.entries(mods).map(([modKey, entry]) => (
                <tr key={modKey}>
                  <td>{modKey}</td>
                  <td className={classes.td}>{entry.entryDepth}</td>
                  <td>{pct(entry.entryDepth, readsCounted)}</td>
                  <td>{formatStrandCounts(entry)}</td>
                  <td>
                    {entry.avgProbability !== undefined
                      ? `${(entry.avgProbability * 100).toFixed(1)}%`
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (item.type === 'snp') {
      const { base, count, total, refbase, avgQual, fwdCount, revCount } = item
      const mutation = refbase ? `${refbase}→${base}` : base
      return (
        <div ref={ref}>
          <table>
            <caption>{location}</caption>
            <thead>
              <tr>
                <th>Base</th>
                <th>Count</th>
                <th>% of Reads</th>
                <th>Strands</th>
                <th>Qual</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{mutation.toUpperCase()}</td>
                <td className={classes.td}>{count}</td>
                <td>{pct(count, total)}</td>
                <td>{`${fwdCount}(+) ${revCount}(-)`}</td>
                <td>
                  {avgQual !== undefined ? reducePrecision(avgQual) : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    }

    if (item.type === 'modification') {
      const { modType, base, count, total, avgProb, fwdCount, revCount, isUnmodified } = item
      const label = isUnmodified ? `Unmodified ${base}` : `${modType} (${base})`
      return (
        <div ref={ref}>
          <table>
            <caption>{location}</caption>
            <thead>
              <tr>
                <th>Modification</th>
                <th>Count</th>
                <th>% of Reads</th>
                <th>Strands</th>
                <th>Avg Prob</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{label}</td>
                <td className={classes.td}>{count}</td>
                <td>{pct(count, total)}</td>
                <td>{`${fwdCount}(+) ${revCount}(-)`}</td>
                <td>
                  {avgProb !== undefined
                    ? `${(avgProb * 100).toFixed(1)}%`
                    : ''}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    }

    // Interbase indicators (insertion, softclip, hardclip)
    const { type, count, total, avgLength, minLength, maxLength, topSequence } = item
    return (
      <div ref={ref}>
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
              <td className={classes.td}>{count}</td>
              <td>{pct(count, total)}</td>
              <td>
                {minLength !== undefined && maxLength !== undefined
                  ? minLength === maxLength
                    ? `${minLength}bp`
                    : `${minLength}-${maxLength}bp (avg ${avgLength?.toFixed(1)}bp)`
                  : avgLength !== undefined
                    ? `avg ${avgLength.toFixed(1)}bp`
                    : ''}
              </td>
            </tr>
            {topSequence ? (
              <tr>
                <td colSpan={4}>
                  Sequence: {topSequence.length > 20 ? `${topSequence.slice(0, 20)}...` : topSequence}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    )
  },
)

export default FlatbushTooltipContents
