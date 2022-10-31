import React from 'react'
import { Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { observer } from 'mobx-react'
import { LinearGenomeViewModel } from '..'
import { makeTicks } from '../util'
import { getTickDisplayStr } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  scaleBarContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  scaleBarZoomContainer: {
    position: 'relative',
    zIndex: 1,
  },
  scaleBar: {
    position: 'absolute',
    display: 'flex',
    pointerEvents: 'none',
  },
  majorTickLabel: {
    fontSize: '11px',
    zIndex: 1,
    background: theme.palette.background.paper,
    lineHeight: 'normal',
    pointerEvents: 'none',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  refLabel: {
    fontSize: '11px',
    position: 'absolute',
    left: '2px',
    top: '-1px',
    fontWeight: 'bold',
    lineHeight: 'normal',
    zIndex: 1,
    pointerEvents: 'none',
    background: theme.palette.background.paper,
  },
}))

const RenderedRefNameLabels = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()

  // find the block that needs pinning to the left side for context
  let lastLeftBlock = 0
  model.staticBlocks.forEach((block, i) => {
    if (block.offsetPx - model.offsetPx < 0) {
      lastLeftBlock = i
    }
  })
  return (
    <>
      {model.staticBlocks.map((block, index) => {
        return block instanceof ContentBlock &&
          (block.isLeftEndOfDisplayedRegion || index === lastLeftBlock) ? (
          <Typography
            key={`refLabel-${block.key}-${index}`}
            style={{
              left:
                index === lastLeftBlock
                  ? Math.max(0, -model.offsetPx)
                  : block.offsetPx - model.offsetPx - 1,
              paddingLeft: index === lastLeftBlock ? 0 : 1,
            }}
            className={classes.refLabel}
            data-testid={`refLabel-${block.refName}`}
          >
            {block.refName}
          </Typography>
        ) : null
      })}
    </>
  )
})

const RenderedScaleBarLabels = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  const { staticBlocks, bpPerPx } = model

  return (
    <>
      {staticBlocks.map(block => {
        const { reversed, start, end } = block
        if (block instanceof ContentBlock) {
          const ticks = makeTicks(start, end, bpPerPx, true, false)

          return ticks
            .filter(t => t.type === 'major')
            .map(t => {
              const x = (reversed ? end - t.base : t.base - start) / bpPerPx
              const baseNumber = t.base + 1
              return (
                <div
                  key={t.base}
                  className={classes.tick}
                  style={{
                    left: x + block.offsetPx - model.staticBlocks.offsetPx,
                  }}
                >
                  {baseNumber ? (
                    <Typography className={classes.majorTickLabel}>
                      {getTickDisplayStr(baseNumber, bpPerPx)}
                    </Typography>
                  ) : null}
                </div>
              )
            })
        }

        return null
      })}
    </>
  )
})

interface ScaleBarProps {
  model: LGV
  style?: React.CSSProperties
  className?: string
}

const ScaleBar = React.forwardRef<HTMLDivElement, ScaleBarProps>(
  ({ model, style, className, ...other }, ref) => {
    const { classes, cx } = useStyles()

    const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
    return (
      <Paper
        data-resizer="true" // used to avoid click-and-drag scrolls on trackscontainer
        className={cx(classes.scaleBarContainer, className)}
        variant="outlined"
        ref={ref}
        style={style}
        {...other}
      >
        <div
          className={classes.scaleBarZoomContainer}
          style={{
            transform:
              model.scaleFactor !== 1
                ? `scaleX(${model.scaleFactor})`
                : undefined,
          }}
        >
          <div
            className={classes.scaleBar}
            style={{
              left: offsetLeft - 1,
              width: model.staticBlocks.totalWidthPx,
              ...style,
            }}
          >
            <RenderedScaleBarLabels model={model} />
          </div>
        </div>
        <RenderedRefNameLabels model={model} />
      </Paper>
    )
  },
)

export default observer(ScaleBar)
