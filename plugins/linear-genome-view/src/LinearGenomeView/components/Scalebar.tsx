import { Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '@jbrowse/core/util/blockTypes'
import { observer } from 'mobx-react'
import React from 'react'
import { LinearGenomeViewModel } from '..'
import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from '../../BaseLinearDisplay/components/Block'
import { makeTicks } from '../util'
import { getTickDisplayStr } from '@jbrowse/core/util'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  scalebarContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  scalebarZoomContainer: {
    position: 'relative',
    zIndex: 1,
  },
  scalebar: {
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

const RenderedScalebarLabels = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  const { bpPerPx, staticBlocks } = model

  return (
    <>
      {staticBlocks.map((block, index) => {
        const { reversed, start, end, key, widthPx } = block
        if (block instanceof ContentBlock) {
          const ticks = makeTicks(start, end, bpPerPx, true, false)

          return (
            <ContentBlockComponent key={`${key}-${index}`} block={block}>
              {ticks.map(tick => {
                if (tick.type === 'major') {
                  const x =
                    (reversed ? end - tick.base : tick.base - start) / bpPerPx
                  const baseNumber = tick.base + 1
                  return (
                    <div
                      key={tick.base}
                      className={classes.tick}
                      style={{ left: x }}
                    >
                      {baseNumber ? (
                        <Typography className={classes.majorTickLabel}>
                          {getTickDisplayStr(baseNumber, bpPerPx)}
                        </Typography>
                      ) : null}
                    </div>
                  )
                }
                return null
              })}
            </ContentBlockComponent>
          )
        }
        if (block instanceof ElidedBlock) {
          return <ElidedBlockComponent key={key} width={widthPx} />
        }
        if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockComponent
              key={key}
              width={widthPx}
              style={{ background: 'none' }}
              boundary={block.variant === 'boundary'}
            />
          )
        }
        return null
      })}
    </>
  )
})

interface ScalebarProps {
  model: LGV
  style?: React.CSSProperties
  className?: string
}

const Scalebar = React.forwardRef<HTMLDivElement, ScalebarProps>(
  ({ model, style, className, ...other }, ref) => {
    const { classes, cx } = useStyles()

    const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
    return (
      <Paper
        data-resizer="true" // used to avoid click-and-drag scrolls on trackscontainer
        className={cx(classes.scalebarContainer, className)}
        variant="outlined"
        ref={ref}
        style={style}
        {...other}
      >
        <div
          className={classes.scalebarZoomContainer}
          style={{
            transform:
              model.scaleFactor !== 1
                ? `scaleX(${model.scaleFactor})`
                : undefined,
          }}
        >
          <div
            className={classes.scalebar}
            style={{
              left: offsetLeft - 1,
              width: model.staticBlocks.totalWidthPx,
              ...style,
            }}
          >
            <RenderedScalebarLabels model={model} />
          </div>
        </div>
        <RenderedRefNameLabels model={model} />
      </Paper>
    )
  },
)

export default observer(Scalebar)
