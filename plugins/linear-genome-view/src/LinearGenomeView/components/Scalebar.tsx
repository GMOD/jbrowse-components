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
    fontSize: 11,
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
    fontSize: 11,
    position: 'absolute',
    left: 2,
    top: -1,
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

const RenderedBlockTicks = function ({
  block,
  bpPerPx,
}: {
  block: ContentBlock
  bpPerPx: number
}) {
  const { classes } = useStyles()
  const { reversed, start, end } = block
  const ticks = makeTicks(start, end, bpPerPx, true, false)

  return (
    <ContentBlockComponent block={block}>
      {ticks.map(({ type, base }) => {
        if (type === 'major') {
          const x = (reversed ? end - base : base - start) / bpPerPx
          const baseNumber = base + 1
          return (
            <div key={base} className={classes.tick} style={{ left: x }}>
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

const RenderedScalebarLabels = observer(({ model }: { model: LGV }) => {
  const { staticBlocks, bpPerPx } = model

  return (
    <>
      {staticBlocks.map((block, idx) => {
        const { key, widthPx } = block
        const k = `${key}-${idx}`
        if (block instanceof ContentBlock) {
          return <RenderedBlockTicks key={k} block={block} bpPerPx={bpPerPx} />
        } else if (block instanceof ElidedBlock) {
          return <ElidedBlockComponent key={k} width={widthPx} />
        } else if (block instanceof InterRegionPaddingBlock) {
          return (
            <InterRegionPaddingBlockComponent
              key={k}
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

const Scalebar = observer(
  React.forwardRef<HTMLDivElement, ScalebarProps>(function Scalebar2(
    { model, style, className, ...other },
    ref,
  ) {
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
  }),
)

export default Scalebar
