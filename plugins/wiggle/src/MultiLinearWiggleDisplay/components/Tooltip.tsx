import { forwardRef } from 'react'

import { Portal, alpha, useTheme } from '@mui/material'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { toP } from '../../util.ts'

import type { MultiWiggleDisplayModel } from './MultiWiggleComponent.tsx'

function round(value: number) {
  return Math.round(value * 1e5) / 1e5
}

const useStyles = makeStyles()(theme => ({
  tooltip: {
    position: 'fixed',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: 100000,
    backgroundColor: alpha(theme.palette.grey[700], 0.9),
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.common.white,
    fontFamily: theme.typography.fontFamily,
    padding: '4px 8px',
    fontSize: theme.typography.fontSize,
    lineHeight: `${round(14 / 10)}em`,
    maxWidth: 300,
    wordWrap: 'break-word',
  },
}))

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
        {summary && minScore != null && maxScore != null ? (
          <span>
            min:{toP(minScore)} avg:{toP(score)} max:{toP(maxScore)}
          </span>
        ) : (
          <span>{toP(score)}</span>
        )}
      </span>
    </div>
  )
}

const TooltipContents = observer(function TooltipContents({
  model,
}: {
  model: MultiWiggleDisplayModel
}) {
  console.log('TooltipContents render')
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

const MultiWiggleTooltip = observer(
  forwardRef<
    HTMLDivElement,
    {
      model: MultiWiggleDisplayModel
      height: number
      crosshairRef: React.RefObject<HTMLDivElement | null>
    }
  >(function MultiWiggleTooltip({ model, height, crosshairRef }, ref) {
    const { classes } = useStyles()
    const theme = useTheme()
    // needed for webcomponent embedding where the portal container is customized
    const popperTheme = theme.components?.MuiPopper
    const { featureUnderMouse } = model

    return (
      <>
        {featureUnderMouse ? (
          <Portal container={popperTheme?.defaultProps?.container}>
            <div ref={ref} className={classes.tooltip}>
              <TooltipContents model={model} />
            </div>
          </Portal>
        ) : null}
        <div
          ref={crosshairRef}
          style={{
            background: 'black',
            border: 'none',
            width: 1,
            height,
            top: 0,
            cursor: 'default',
            position: 'absolute',
            pointerEvents: 'none',
            left: 0,
            display: featureUnderMouse ? undefined : 'none',
          }}
        />
      </>
    )
  }),
)

export default MultiWiggleTooltip
