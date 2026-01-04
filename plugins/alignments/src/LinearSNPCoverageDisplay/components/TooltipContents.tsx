import { forwardRef } from 'react'

import { reducePrecision, toLocale } from '@jbrowse/core/util'

import { formatStrandCounts, pct, useTooltipStyles } from './tooltipUtils'
import { getInterbaseTypeLabel } from '../../SNPCoverageRenderer/types'
import { getModificationName } from '../../shared/modificationData'

import type { ClickMapItem } from '../../SNPCoverageRenderer/types'
import type { BaseCoverageBin } from '../../shared/types'
import type { Feature } from '@jbrowse/core/util'

interface Model {
  visibleModifications: Map<
    string,
    { color: string; base: string; strand: string }
  >
  simplexModifications?: Set<string>
}

interface Props {
  feature?: Feature
  item?: ClickMapItem
  refName?: string
  model: Model
}

interface StrandCounts {
  readonly entryDepth: number
  readonly '1': number
  readonly '-1': number
  readonly avgProbability?: number
}

interface MutableStrandCounts {
  entryDepth: number
  '1': number
  '-1': number
  avgProbability?: number
}

function getModificationColor(base: string, model: Model): string | undefined {
  if (!base.startsWith('mod_') && !base.startsWith('nonmod_')) {
    return undefined
  }
  if (base.startsWith('nonmod_')) {
    return 'blue'
  }
  return model.visibleModifications.get(base.replace(/^mod_/, ''))?.color
}

function isModification(base: string): boolean {
  return base.startsWith('mod_') || base.startsWith('nonmod_')
}

function getModificationType(base: string): string {
  return base.replace(/^(mod_|nonmod_)/, '')
}

function shouldShowPercentage(base: string): boolean {
  return base !== 'depth' && base !== 'skip'
}

function getModificationLabel(base: string, model: Model): string {
  const isNonmod = base.startsWith('nonmod_')
  if (isNonmod) {
    const genomicBase = base.replace('nonmod_', '')
    return `Unmodified ${genomicBase}`
  }
  const modType = getModificationType(base)
  const mod = model.visibleModifications.get(modType)
  if (mod) {
    return getModificationName(modType)
  }
  return base.toUpperCase()
}

function getDuplexModificationLabel(base: string, model: Model): string {
  const isNonmod = base.startsWith('nonmod_')
  if (isNonmod) {
    const genomicBase = base.replace('nonmod_', '')
    return `Unmodified ${genomicBase}`
  }
  const modType = getModificationType(base)
  const mod = model.visibleModifications.get(modType)
  if (!mod) {
    return base.toUpperCase()
  }
  return getModificationName(modType)
}

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
      <td />
      <td />
      <td />
    </tr>
  )
}

function RefRow({
  referenceBase,
  reference,
  readsCounted,
}: {
  referenceBase?: string
  reference: StrandCounts
  readsCounted: number
}) {
  return (
    <tr>
      <td />
      <td>REF {referenceBase ? `(${referenceBase.toUpperCase()})` : ''}</td>
      <td>{reference.entryDepth}</td>
      <td>{pct(reference.entryDepth, readsCounted)}</td>
      <td>{formatStrandCounts(reference)}</td>
      <td />
    </tr>
  )
}

function DuplexModificationRow({
  base,
  score,
  readsCounted,
  model,
  tdClass,
  rowKey,
}: {
  base: string
  score: StrandCounts
  posStrandCount: number
  negStrandCount: number
  readsCounted: number
  model: Model
  tdClass: string
  rowKey: string
}) {
  return (
    <tr key={rowKey}>
      <td>
        <ColorSquare model={model} base={base} />
      </td>
      <td>{getDuplexModificationLabel(base, model)}</td>
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
  readsCounted,
  model,
  tdClass,
  rowKey,
}: {
  base: string
  score: StrandCounts
  isMod: boolean
  isSimplex?: boolean
  readsCounted: number
  model: Model
  tdClass: string
  rowKey: string
}) {
  return (
    <tr key={rowKey}>
      <td>
        <ColorSquare model={model} base={base} />
      </td>
      <td>{isMod ? getModificationLabel(base, model) : base.toUpperCase()}</td>
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
}: {
  info: Record<string, Record<string, StrandCounts>>
  readsCounted: number
  model: Model
  tdClass: string
}) {
  const consolidatedEntries: Record<
    string,
    { base: string; score: MutableStrandCounts; isNonmod: boolean }
  > = {}

  for (const [key, entry] of Object.entries(info)) {
    for (const [base, score] of Object.entries(entry)) {
      const isNonmod = base.startsWith('nonmod_')
      if (isNonmod) {
        const modType = getModificationType(base)
        const mod = model.visibleModifications.get(modType)
        const genomicBase = mod?.base || 'X'
        const consolidatedKey = `${key}_nonmod_${genomicBase}`

        if (!consolidatedEntries[consolidatedKey]) {
          consolidatedEntries[consolidatedKey] = {
            base: `nonmod_${genomicBase}`,
            score: {
              entryDepth: 0,
              '1': 0,
              '-1': 0,
              avgProbability: 0,
            },
            isNonmod: true,
          }
        }

        const consolidated = consolidatedEntries[consolidatedKey]
        consolidated.score.entryDepth += score.entryDepth
        consolidated.score['1'] += score['1']
        consolidated.score['-1'] += score['-1']

        if (score.avgProbability !== undefined) {
          const prevAvg = consolidated.score.avgProbability || 0
          const prevCount = consolidated.score.entryDepth - score.entryDepth
          consolidated.score.avgProbability =
            prevCount > 0
              ? (prevAvg * prevCount +
                  score.avgProbability * score.entryDepth) /
                consolidated.score.entryDepth
              : score.avgProbability
        }
      } else {
        consolidatedEntries[`${key}_${base}`] = {
          base,
          score: { ...score },
          isNonmod: false,
        }
      }
    }
  }

  return (
    <>
      {Object.entries(consolidatedEntries).map(
        ([rowKey, { base, score, isNonmod }]) => {
          const modType = getModificationType(base)
          const isMod = isModification(base) || isNonmod
          const isSimplex =
            !isNonmod && isMod && model.simplexModifications?.has(modType)
          const posStrandCount = score['1'] || 0
          const negStrandCount = score['-1'] || 0

          if (isNonmod) {
            return (
              <SimplexOrRegularRow
                key={rowKey}
                base={base}
                score={score}
                isMod={true}
                isSimplex={false}
                readsCounted={readsCounted}
                model={model}
                tdClass={tdClass}
                rowKey={rowKey}
              />
            )
          }

          if (
            isMod &&
            !isSimplex &&
            (posStrandCount > 0 || negStrandCount > 0)
          ) {
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
                rowKey={rowKey}
              />
            )
          }

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
              rowKey={rowKey}
            />
          )
        },
      )}
    </>
  )
}

function formatLocation(refName?: string, start?: number, end?: number) {
  if (start === undefined) {
    return refName || ''
  }
  const pos =
    end === undefined || start === end - 1
      ? toLocale(start + 1)
      : `${toLocale(start + 1)}..${toLocale(end)}`
  return refName ? `${refName}:${pos}` : pos
}

function BinTooltip({
  bin,
  location,
  model,
  tdClass,
  reactRef,
}: {
  bin: BaseCoverageBin
  location: string
  model: Model
  tdClass: string
  reactRef: React.Ref<HTMLDivElement>
}) {
  const { refbase: referenceBase, readsCounted, ref: reference, ...info } = bin

  return (
    <div ref={reactRef}>
      <table>
        <caption>{location}</caption>
        <TableHeader />
        <tbody>
          <TotalRow readsCounted={readsCounted} />
          <RefRow
            referenceBase={referenceBase}
            reference={reference}
            readsCounted={readsCounted}
          />
          <ModificationRows
            info={info}
            readsCounted={readsCounted}
            model={model}
            tdClass={tdClass}
          />
        </tbody>
      </table>
    </div>
  )
}

function SimpleSNPTooltip({
  item,
  location,
  tdClass,
  reactRef,
}: {
  item: {
    base: string
    count: number
    total: number
    refbase?: string
    avgQual?: number
    fwdCount: number
    revCount: number
  }
  location: string
  tdClass: string
  reactRef: React.Ref<HTMLDivElement>
}) {
  const { base, count, total, refbase, avgQual, fwdCount, revCount } = item
  const mutation = refbase ? `${refbase}→${base}` : base
  return (
    <div ref={reactRef}>
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
            <td className={tdClass}>{count}</td>
            <td>{pct(count, total)}</td>
            <td>{`${fwdCount}(+) ${revCount}(-)`}</td>
            <td>{avgQual !== undefined ? reducePrecision(avgQual) : ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ModificationTooltip({
  item,
  location,
  model,
  tdClass,
  reactRef,
}: {
  item: {
    modType: string
    base: string
    count: number
    total: number
    avgProb?: number
    fwdCount: number
    revCount: number
    isUnmodified: boolean
  }
  location: string
  model: Model
  tdClass: string
  reactRef: React.Ref<HTMLDivElement>
}) {
  const {
    modType,
    base,
    count,
    total,
    avgProb,
    fwdCount,
    revCount,
    isUnmodified,
  } = item
  const color = isUnmodified
    ? 'blue'
    : model.visibleModifications.get(modType)?.color
  const label = isUnmodified
    ? `Unmodified ${base}`
    : getModificationName(modType) || `${modType} (${base})`
  return (
    <div ref={reactRef}>
      <table>
        <caption>{location}</caption>
        <thead>
          <tr>
            <th />
            <th>Modification</th>
            <th>Count</th>
            <th>% of Reads</th>
            <th>Strands</th>
            <th>Avg Prob</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {color ? (
                <div style={{ width: 10, height: 10, background: color }} />
              ) : null}
            </td>
            <td>{label}</td>
            <td className={tdClass}>{count}</td>
            <td>{pct(count, total)}</td>
            <td>{`${fwdCount}(+) ${revCount}(-)`}</td>
            <td>
              {avgProb !== undefined ? `${(avgProb * 100).toFixed(1)}%` : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function InterbaseTooltip({
  item,
  location,
  tdClass,
  reactRef,
}: {
  item: {
    type: string
    count: number
    total: number
    avgLength?: number
    minLength?: number
    maxLength?: number
    topSequence?: string
  }
  location: string
  tdClass: string
  reactRef: React.Ref<HTMLDivElement>
}) {
  const { type, count, total, avgLength, minLength, maxLength, topSequence } =
    item

  const sizeStr =
    minLength !== undefined && maxLength !== undefined
      ? minLength === maxLength
        ? `${minLength}bp`
        : `${minLength}-${maxLength}bp (avg ${avgLength?.toFixed(1)}bp)`
      : avgLength !== undefined
        ? `avg ${avgLength.toFixed(1)}bp`
        : ''

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
          {topSequence ? (
            <tr>
              <td colSpan={4}>
                Sequence:{' '}
                {topSequence.length > 20
                  ? `${topSequence.slice(0, 20)}...`
                  : topSequence}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

const TooltipContents = forwardRef<HTMLDivElement, Props>(
  function TooltipContents2(props, reactRef) {
    const { feature, item, refName, model } = props
    const { classes } = useTooltipStyles()

    // Handle ClickMapItem (from flatbush)
    if (item) {
      const location = formatLocation(
        refName,
        item.start,
        'end' in item ? item.end : undefined,
      )

      // SNP with full bin data - use the full table
      if (item.type === 'snp' && item.bin) {
        return (
          <BinTooltip
            bin={item.bin}
            location={location}
            model={model}
            tdClass={classes.td}
            reactRef={reactRef}
          />
        )
      }

      // Simple SNP (no bin data)
      if (item.type === 'snp') {
        return (
          <SimpleSNPTooltip
            item={item}
            location={location}
            tdClass={classes.td}
            reactRef={reactRef}
          />
        )
      }

      // Modification
      if (item.type === 'modification') {
        return (
          <ModificationTooltip
            item={item}
            location={location}
            model={model}
            tdClass={classes.td}
            reactRef={reactRef}
          />
        )
      }

      // Interbase indicators (insertion, softclip, hardclip)
      return (
        <InterbaseTooltip
          item={item}
          location={location}
          tdClass={classes.td}
          reactRef={reactRef}
        />
      )
    }

    // Handle Feature (normal coverage tooltip)
    if (feature) {
      const start = feature.get('start')
      const end = feature.get('end')
      const name = feature.get('refName')
      const snpinfo = feature.get('snpinfo') as BaseCoverageBin
      const location = formatLocation(name, start, end)

      return (
        <BinTooltip
          bin={snpinfo}
          location={location}
          model={model}
          tdClass={classes.td}
          reactRef={reactRef}
        />
      )
    }

    return null
  },
)

export default TooltipContents
