import { readConfObject } from '@jbrowse/core/configuration'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { getSnapshot, Instance } from 'mobx-state-tree'
import ComparativeServerSideRendererType, {
  RenderArgsDeserialized as ComparativeRenderArgsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { Dotplot1DView } from '../DotplotView/model'

type Dim = Instance<typeof Dotplot1DView>

const { parseCigar } = MismatchParser

export interface RenderArgsDeserialized
  extends ComparativeRenderArgsDeserialized {
  height: number
  width: number
  highResolutionScaling: number
  view: { hview: Dim; vview: Dim }
}

function bpToPx({
  refName,
  coord,
  regionNumber,
  self,
}: {
  refName: string
  coord: number
  regionNumber?: number
  self: {
    bpPerPx: number
    interRegionPaddingWidth: number
    minimumBlockWidth: number
    width: number
    displayedRegions: {
      start: number
      end: number
      refName: string
      reversed: boolean
    }[]
  }
}) {
  let offsetBp = 0

  const interRegionPaddingBp = self.interRegionPaddingWidth * self.bpPerPx
  const minimumBlockBp = self.minimumBlockWidth * self.bpPerPx
  const index = self.displayedRegions.findIndex((region, idx) => {
    const len = region.end - region.start
    if (
      refName === region.refName &&
      coord >= region.start &&
      coord <= region.end
    ) {
      if (regionNumber ? regionNumber === idx : true) {
        offsetBp += region.reversed ? region.end - coord : coord - region.start
        return true
      }
    }

    // add the interRegionPaddingWidth if the boundary is in the screen
    // e.g. offset>0 && offset<width
    if (
      region.end - region.start > minimumBlockBp &&
      offsetBp / self.bpPerPx > 0 &&
      offsetBp / self.bpPerPx < self.width
    ) {
      offsetBp += len + interRegionPaddingBp
    } else {
      offsetBp += len
    }
    return false
  })

  const foundRegion = self.displayedRegions[index]
  if (foundRegion) {
    return Math.round(offsetBp / self.bpPerPx)
  }

  return undefined
}

export default class DotplotRenderer extends ComparativeServerSideRendererType {
  async makeImageData(props: RenderArgsDeserialized & { views: Dim[] }) {
    const {
      highResolutionScaling: scale = 1,
      width,
      height,
      config,
      views,
    } = props

    const canvas = createCanvas(Math.ceil(width * scale), height * scale)
    const ctx = canvas.getContext('2d')
    const lineWidth = readConfObject(config, 'lineWidth')
    const posColor = readConfObject(config, 'posColor')
    const negColor = readConfObject(config, 'negColor')
    ctx.lineWidth = lineWidth
    ctx.scale(scale, scale)
    const [hview, vview] = views
    const db1 = hview.dynamicBlocks.contentBlocks[0].offsetPx
    const db2 = vview.dynamicBlocks.contentBlocks[0].offsetPx

    hview.features?.forEach(feature => {
      let start = feature.get('start')
      let end = feature.get('end')
      const strand = feature.get('strand') || 1
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      const mateRef = mate.refName
      ctx.fillStyle = posColor
      ctx.strokeStyle = posColor
      if (strand === -1) {
        ctx.fillStyle = negColor
        ctx.strokeStyle = negColor
        ;[end, start] = [start, end]
      }
      const hvsnap = {
        ...getSnapshot(hview),
        interRegionPaddingWidth: hview.interRegionPaddingWidth,
        width: hview.width,
      }
      const vvsnap = {
        ...getSnapshot(vview),
        interRegionPaddingWidth: vview.interRegionPaddingWidth,
        width: vview.width,
      }
      const b10 = bpToPx({ self: hvsnap, refName, coord: start })
      const b20 = bpToPx({ self: hvsnap, refName, coord: end })
      const e10 = bpToPx({ self: vvsnap, refName: mateRef, coord: mate.start })
      const e20 = bpToPx({ self: vvsnap, refName: mateRef, coord: mate.end })
      if (
        b10 !== undefined &&
        b20 !== undefined &&
        e10 !== undefined &&
        e20 !== undefined
      ) {
        const b1 = b10 - db1
        const b2 = b20 - db1
        const e1 = e10 - db2
        const e2 = e20 - db2
        if (Math.abs(b1 - b2) < 3 && Math.abs(e1 - e2) < 3) {
          ctx.fillRect(
            b1 - lineWidth / 2,
            height - e1 - lineWidth / 2,
            lineWidth,
            lineWidth,
          )
        } else {
          let currX = b1
          let currY = e1
          const cigar = feature.get('cg') || feature.get('CIGAR')
          if (cigar) {
            const cigarOps = parseCigar(cigar)
            ctx.beginPath()
            for (let i = 0; i < cigarOps.length; i += 2) {
              const val = +cigarOps[i]
              const op = cigarOps[i + 1]

              const prevX = currX
              const prevY = currY

              if (op === 'M' || op === '=' || op === 'X') {
                currX += (val / hview.bpPerPx) * strand
                currY += val / vview.bpPerPx
              } else if (op === 'D' || op === 'N') {
                currX += (val / hview.bpPerPx) * strand
              } else if (op === 'I') {
                currY += val / vview.bpPerPx
              }
              ctx.moveTo(prevX, height - prevY)
              ctx.lineTo(currX, height - currY)
            }
            ctx.stroke()
          } else {
            ctx.beginPath()
            ctx.moveTo(b1, height - e1)
            ctx.lineTo(b2, height - e2)
            ctx.stroke()
          }
        }
      } else {
        console.warn(
          `feature at ${refName}:${start}-${end} ${mateRef}:${mate.start}-${mate.end} not plotted, fell outside of range ${b10} ${b20} ${e10} ${e20}`,
        )
      }
    })
    return createImageBitmap(canvas)
  }

  async render(renderProps: RenderArgsDeserialized) {
    const {
      width,
      height,
      view: { hview, vview },
    } = renderProps
    const dimensions = [width, height]
    const realizedViews = [hview, vview].map((snap, idx) => {
      const view = Dotplot1DView.create(snap)
      view.setVolatileWidth(dimensions[idx])
      return view
    })
    await Promise.all(
      realizedViews.map(async view => {
        const feats = await this.getFeatures({
          ...renderProps,
          regions: view.dynamicBlocks.contentBlocks,
        })
        view.setFeatures(feats)
      }),
    )
    const imageData = await this.makeImageData({
      ...renderProps,
      views: realizedViews,
    })

    const results = await super.render({
      ...renderProps,
      height,
      width,
      imageData,
    })

    return {
      ...results,
      imageData,
      height,
      width,
      offsetX: realizedViews[0].dynamicBlocks.blocks[0].offsetPx,
      offsetY: realizedViews[1].dynamicBlocks.blocks[0].offsetPx,
    }
  }
}
