import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { toLocale } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  WiggleCursorLine,
  WiggleScoreDisplay,
} from '../../shared/WiggleTooltipShared.tsx'

import type { MultiWiggleDisplayModel } from './MultiWiggleComponent.tsx'

type Coord = [number, number]

function SourceRow({
  src,
  score,
  summary,
  minScore,
  maxScore,
  sourceObj,
}: {
  src: string
  score: number
  summary?: boolean
  minScore?: number
  maxScore?: number
  sourceObj?: { color?: string }
}) {
  return (
    <div>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {sourceObj?.color ? (
          <span
            style={{
              width: 10,
              height: 10,
              background: sourceObj.color,
              display: 'inline-block',
            }}
          />
        ) : null}
        {src}
        {': '}
        <WiggleScoreDisplay
          score={score}
          summary={summary}
          minScore={minScore}
          maxScore={maxScore}
        />
      </span>
    </div>
  )
}

const TooltipContents = observer(function TooltipContents({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  const { featureUnderMouse } = model
  if (!featureUnderMouse) {
    return null
  }
  const {
    refName,
    start,
    end,
    score,
    minScore,
    maxScore,
    source,
    summary,
    allSources,
  } = featureUnderMouse
  const coord =
    start === end ? toLocale(start) : `${toLocale(start)}..${toLocale(end)}`

  return (
    <div>
      {[refName, coord].filter(f => !!f).join(':')}
      <br />
      {allSources ? (
        <>
          {allSources.slice(0, 8).map(s => (
            <SourceRow
              key={s.source}
              src={s.source}
              score={s.score}
              summary={s.summary}
              minScore={s.minScore}
              maxScore={s.maxScore}
              sourceObj={model.sources.find(ms => ms.name === s.source)}
            />
          ))}
          {allSources.length > 8 ? (
            <div style={{ fontStyle: 'italic', marginTop: 4 }}>
              +{allSources.length - 8} more
            </div>
          ) : null}
        </>
      ) : (
        <SourceRow
          src={source}
          score={score}
          summary={summary}
          minScore={minScore}
          maxScore={maxScore}
          sourceObj={model.sources.find(s => s.name === source)}
        />
      )}
    </div>
  )
})

const MultiWiggleTooltip = observer(function MultiWiggleTooltip({
  model,
  height,
  clientMouseCoord,
  offsetMouseCoord,
}: {
  model: MultiWiggleDisplayModel
  height: number
  clientMouseCoord: Coord
  offsetMouseCoord: Coord
}) {
  const { featureUnderMouse } = model
  return featureUnderMouse ? (
    <>
      <BaseTooltip
        clientPoint={{
          x: clientMouseCoord[0] + 5,
          y: clientMouseCoord[1],
        }}
      >
        <TooltipContents model={model} />
      </BaseTooltip>
      <WiggleCursorLine height={height} left={offsetMouseCoord[0]} />
    </>
  ) : null
})

export default MultiWiggleTooltip
