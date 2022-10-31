import React, { useEffect, useRef } from 'react'
import {
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from '@jbrowse/core/util/blockTypes'
import { useTheme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import { LinearGenomeViewModel } from '..'
import { makeTicks } from '../util'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    zIndex: 1,
    pointerEvents: 'none',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    zIndex: 1,
    pointerEvents: 'none',
    display: 'flex',
  },
})
const RenderedVerticalGuides = observer(({ model }: { model: LGV }) => {
  const { staticBlocks, bpPerPx } = model
  const theme = useTheme()
  const ref = useRef<HTMLCanvasElement>(null)
  const w = staticBlocks.totalWidthPx
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const p = theme.palette
    const light = p.divider
    const dark = p.text.secondary
    const height = canvas.height
    const w = canvas.width
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.clearRect(0, 0, w, height)
    ctx.resetTransform()
    staticBlocks.forEach(b => {
      const offset = b.offsetPx - staticBlocks.offsetPx
      if (b instanceof ContentBlock) {
        makeTicks(b.start, b.end, model.bpPerPx).forEach(t => {
          const x = (b.reversed ? b.end - t.base : t.base - b.start) / bpPerPx
          if (x < 0 || x > b.widthPx) {
            return
          }
          ctx.fillStyle =
            t.type === 'major' || t.type === 'labeledMajor' ? dark : light
          ctx.fillRect(Math.round(x + offset), 0, 1, height)
        })
      }
      if (b instanceof ElidedBlock) {
        ctx.fillStyle = '#999'
        ctx.fillRect(Math.round(offset), 0, b.widthPx, height)
      }
      if (b instanceof InterRegionPaddingBlock) {
        ctx.fillStyle = b.key.includes('Region') ? '#999' : '#000'
        ctx.fillRect(Math.round(offset), 0, b.widthPx, height)
      }
    })
  }, [
    bpPerPx,
    w,
    staticBlocks,
    model.bpPerPx,
    theme.palette.text.secondary,
    theme.palette.divider,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(staticBlocks),
  ])
  return (
    <canvas
      ref={ref}
      width={w * window.devicePixelRatio}
      style={{
        width: w,
        height: '100%',
      }}
    />
  )
})
function VerticalGuides({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const { staticBlocks } = model
  // find the block that needs pinning to the left side for context
  const offsetLeft = staticBlocks.offsetPx - model.offsetPx
  return (
    <div
      className={classes.verticalGuidesZoomContainer}
      style={{
        transform:
          model.scaleFactor !== 1 ? `scaleX(${model.scaleFactor})` : undefined,
      }}
    >
      <div
        className={classes.verticalGuidesContainer}
        style={{
          left: offsetLeft,
          width: staticBlocks.totalWidthPx,
        }}
      >
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
}

export default observer(VerticalGuides)
