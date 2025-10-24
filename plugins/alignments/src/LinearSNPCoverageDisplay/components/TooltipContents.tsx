import { forwardRef } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

import type { BaseCoverageBin } from '../../shared/types'
import type { Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()(() => ({
  td: {
    whiteSpace: 'nowrap',
  },
  baseColumn: {
    whiteSpace: 'nowrap',
  },
}))

const toP = (s = 0) => +s.toFixed(1)

const pct = (n: number, total = 1) => `${toP((n / (total || 1)) * 100)}%`

interface Props {
  feature: Feature
  model: {
    visibleModifications: Map<
      string,
      { color: string; base: string; strand: string }
    >
    simplexModifications?: Set<string>
  }
}

interface Model {
  visibleModifications: Map<
    string,
    { color: string; base: string; strand: string }
  >
}

interface StrandCounts {
  readonly entryDepth: number
  readonly '1': number
  readonly '-1': number
  readonly avgProbability?: number
}

// Helper functions
function getModificationColor(base: string, model: Model): string | undefined {
  if (!base.startsWith('mod_') && !base.startsWith('nonmod_')) {
    return undefined
  }
  return model.visibleModifications.get(
    base.replace(/^(mod_|nonmod_)/, ''),
  )?.color
}

function isModification(base: string): boolean {
  return base.startsWith('mod_') || base.startsWith('nonmod_')
}

function getModificationType(base: string): string {
  return base.replace(/^(mod_|nonmod_)/, '')
}

function formatStrandCounts(score: StrandCounts): string {
  const neg = score['-1'] ? `${score['-1']}(-)` : ''
  const pos = score['1'] ? `${score['1']}(+)` : ''
  return neg + pos
}

function shouldShowPercentage(base: string): boolean {
  return base !== 'depth' && base !== 'skip'
}

// Sub-components
function ColorSquare({ base, model }: { base: string; model: Model }) {
  const color = getModificationColor(base, model)
  if (!color) {
    return null
  }
  return <div style={{ width: 10, height: 10, background: color }} />
}

const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2(props, reactRef) {
    const { feature, model } = props
    const { classes } = useStyles()
    const start = feature.get('start') + 1
    const end = feature.get('end')
    const name = feature.get('refName')
    const { refbase, readsCounted, depth, ref, ...info } = feature.get(
      'snpinfo',
    ) as BaseCoverageBin

    return (
      <div ref={reactRef}>
        <table>
          <caption>
            {[
              name,
              start === end
                ? toLocale(start)
                : `${toLocale(start)}..${toLocale(end)}`,
            ]
              .filter(f => !!f)
              .join(':')}
          </caption>
          <thead>
            <tr>
              <th />
              <th>Base</th>
              <th>Count</th>
              <th>% of Reads</th>
              <th>Strands</th>
              <th>Avg Prob</th>
            </tr>
          </thead>
          <tbody>
            {/* Total row */}
            <tr>
              <td />
              <td>Total</td>
              <td>{readsCounted}</td>
              <td> </td>
              <td> </td>
              <td> </td>
            </tr>

            {/* Reference row */}
            <tr>
              <td />
              <td className={classes.baseColumn}>
                REF {refbase ? `(${refbase.toUpperCase()})` : ''}
              </td>
              <td>{ref.entryDepth}</td>
              <td>{pct(ref.entryDepth, readsCounted)}</td>
              <td>{formatStrandCounts(ref)}</td>
              <td> </td>
            </tr>

            {/* Modification rows */}
            {Object.entries(info).map(([key, entry]) =>
              Object.entries(entry).flatMap(([base, score]) => {
                const modType = getModificationType(base)
                const isMod = isModification(base)
                const isSimplex =
                  isMod && model.simplexModifications?.has(modType)
                const posStrandCount = score['1'] || 0
                const negStrandCount = score['-1'] || 0

                // Duplex modifications: show total + strand breakdown
                if (
                  isMod &&
                  !isSimplex &&
                  (posStrandCount > 0 || negStrandCount > 0)
                ) {
                  const rows = []

                  // Total row
                  rows.push(
                    <tr key={`${key}_${base}_total`}>
                      <td>
                        <ColorSquare model={model} base={base} />
                      </td>
                      <td className={classes.baseColumn}>
                        {base.toUpperCase()} (duplex)
                      </td>
                      <td className={classes.td}>{score.entryDepth}</td>
                      <td>
                        {shouldShowPercentage(base)
                          ? pct(score.entryDepth, readsCounted)
                          : '---'}
                      </td>
                      <td>{posStrandCount + negStrandCount}</td>
                      <td>
                        {score.avgProbability !== undefined
                          ? pct(score.avgProbability)
                          : ''}
                      </td>
                    </tr>,
                  )

                  // Positive strand row
                  if (posStrandCount > 0) {
                    rows.push(
                      <tr key={`${key}_${base}_pos`}>
                        <td>↳</td>
                        <td className={classes.baseColumn}>+ strand</td>
                        <td className={classes.td}>{posStrandCount}</td>
                        <td>{pct(posStrandCount, readsCounted)}</td>
                        <td>{posStrandCount}(+)</td>
                        <td> </td>
                      </tr>,
                    )
                  }

                  // Negative strand row
                  if (negStrandCount > 0) {
                    rows.push(
                      <tr key={`${key}_${base}_neg`}>
                        <td>↳</td>
                        <td className={classes.baseColumn}>- strand</td>
                        <td className={classes.td}>{negStrandCount}</td>
                        <td>{pct(negStrandCount, readsCounted)}</td>
                        <td>{negStrandCount}(-)</td>
                        <td> </td>
                      </tr>,
                    )
                  }

                  return rows
                }

                // Simplex or regular entries: single row
                return (
                  <tr key={`${key}_${base}`}>
                    <td>
                      <ColorSquare model={model} base={base} />
                    </td>
                    <td className={classes.baseColumn}>
                      {base.toUpperCase()}
                      {isMod && isSimplex ? ' (simplex)' : ''}
                    </td>
                    <td className={classes.td}>{score.entryDepth}</td>
                    <td>
                      {shouldShowPercentage(base)
                        ? pct(score.entryDepth, readsCounted)
                        : '---'}
                    </td>
                    <td>{formatStrandCounts(score)}</td>
                    <td>
                      {score.avgProbability !== undefined
                        ? pct(score.avgProbability)
                        : ''}
                    </td>
                  </tr>
                )
              }),
            )}
          </tbody>
        </table>
      </div>
    )
  },
)

export default TooltipContents
