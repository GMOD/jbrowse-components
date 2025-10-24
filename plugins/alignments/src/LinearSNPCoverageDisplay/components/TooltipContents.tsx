import { forwardRef } from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

import { getModificationName } from '../../shared/modificationData'

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

// Helper functions (no JSX)
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

function getModificationLabel(base: string, model: Model): string {
  const modType = getModificationType(base)
  const mod = model.visibleModifications.get(modType)
  if (mod) {
    const modName = getModificationName(modType)
    return `${mod.base}${mod.strand}${modType} ${modName}`
  }
  return base.toUpperCase()
}

// React components
function ColorSquare({ base, model }: { base: string; model: Model }) {
  const color = getModificationColor(base, model)
  if (!color) {
    return null
  }
  return <div style={{ width: 10, height: 10, background: color }} />
}

function TableHeader() {
  return (
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
  )
}

function TotalRow({ readsCounted }: { readsCounted: number }) {
  return (
    <tr>
      <td />
      <td>Total</td>
      <td>{readsCounted}</td>
      <td> </td>
      <td> </td>
      <td> </td>
    </tr>
  )
}

function RefRow({
  refbase,
  ref,
  readsCounted,
  baseColumnClass,
}: {
  refbase?: string
  ref: StrandCounts
  readsCounted: number
  baseColumnClass: string
}) {
  return (
    <tr>
      <td />
      <td className={baseColumnClass}>
        REF {refbase ? `(${refbase.toUpperCase()})` : ''}
      </td>
      <td>{ref.entryDepth}</td>
      <td>{pct(ref.entryDepth, readsCounted)}</td>
      <td>{formatStrandCounts(ref)}</td>
      <td> </td>
    </tr>
  )
}

function DuplexModificationRow({
  base,
  score,
  posStrandCount,
  negStrandCount,
  readsCounted,
  model,
  tdClass,
  baseColumnClass,
  rowKey,
}: {
  base: string
  score: StrandCounts
  posStrandCount: number
  negStrandCount: number
  readsCounted: number
  model: Model
  tdClass: string
  baseColumnClass: string
  rowKey: string
}) {
  return (
    <tr key={rowKey}>
      <td>
        <ColorSquare model={model} base={base} />
      </td>
      <td className={baseColumnClass}>
        {getModificationLabel(base, model)} (duplex)
      </td>
      <td className={tdClass}>{score.entryDepth}</td>
      <td>
        {shouldShowPercentage(base)
          ? pct(score.entryDepth, readsCounted)
          : '---'}
      </td>
      <td>{formatStrandCounts(score)}</td>
      <td>
        {score.avgProbability !== undefined ? pct(score.avgProbability) : ''}
      </td>
    </tr>
  )
}

function SimplexOrRegularRow({
  base,
  score,
  isMod,
  isSimplex,
  readsCounted,
  model,
  tdClass,
  baseColumnClass,
  rowKey,
}: {
  base: string
  score: StrandCounts
  isMod: boolean
  isSimplex: boolean
  readsCounted: number
  model: Model
  tdClass: string
  baseColumnClass: string
  rowKey: string
}) {
  return (
    <tr key={rowKey}>
      <td>
        <ColorSquare model={model} base={base} />
      </td>
      <td className={baseColumnClass}>
        {isMod ? getModificationLabel(base, model) : base.toUpperCase()}
        {isMod && isSimplex ? ' (simplex)' : ''}
      </td>
      <td className={tdClass}>{score.entryDepth}</td>
      <td>
        {shouldShowPercentage(base)
          ? pct(score.entryDepth, readsCounted)
          : '---'}
      </td>
      <td>{formatStrandCounts(score)}</td>
      <td>
        {score.avgProbability !== undefined ? pct(score.avgProbability) : ''}
      </td>
    </tr>
  )
}

function ModificationRows({
  info,
  readsCounted,
  model,
  tdClass,
  baseColumnClass,
}: {
  info: Record<string, Record<string, StrandCounts>>
  readsCounted: number
  model: Props['model']
  tdClass: string
  baseColumnClass: string
}) {
  return (
    <>
      {Object.entries(info).map(([key, entry]) =>
        Object.entries(entry).map(([base, score]) => {
          const modType = getModificationType(base)
          const isMod = isModification(base)
          const isSimplex = isMod && model.simplexModifications?.has(modType)
          const posStrandCount = score['1'] || 0
          const negStrandCount = score['-1'] || 0
          const rowKey = `${key}_${base}`

          // Duplex modifications: single row with strand info
          if (isMod && !isSimplex && (posStrandCount > 0 || negStrandCount > 0)) {
            return (
              <DuplexModificationRow
                key={rowKey}
                base={base}
                score={score}
                posStrandCount={posStrandCount}
                negStrandCount={negStrandCount}
                readsCounted={readsCounted}
                model={model}
                tdClass={tdClass}
                baseColumnClass={baseColumnClass}
                rowKey={rowKey}
              />
            )
          }

          // Simplex or regular entries: single row
          return (
            <SimplexOrRegularRow
              key={rowKey}
              base={base}
              score={score}
              isMod={isMod}
              isSimplex={isSimplex}
              readsCounted={readsCounted}
              model={model}
              tdClass={tdClass}
              baseColumnClass={baseColumnClass}
              rowKey={rowKey}
            />
          )
        }),
      )}
    </>
  )
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
          <TableHeader />
          <tbody>
            <TotalRow readsCounted={readsCounted} />
            <RefRow
              refbase={refbase}
              ref={ref}
              readsCounted={readsCounted}
              baseColumnClass={classes.baseColumn}
            />
            <ModificationRows
              info={info}
              readsCounted={readsCounted}
              model={model}
              tdClass={classes.td}
              baseColumnClass={classes.baseColumn}
            />
          </tbody>
        </table>
      </div>
    )
  },
)

export default TooltipContents
