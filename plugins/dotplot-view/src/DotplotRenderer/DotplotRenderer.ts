import { readConfObject } from '@jbrowse/core/configuration'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { viewBpToPx, renameRegionsIfNeeded } from '@jbrowse/core/util'
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

export default class DotplotRenderer extends ComparativeServerSideRendererType {
  async renameRegionsIfNeeded(args: any) {
    const assemblyManager =
      this.pluginManager.rootModel?.session?.assemblyManager

    if (!assemblyManager) {
      throw new Error('No assembly manager provided')
    }

    args.view.hview.displayedRegions = (
      await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId,
        regions: args.view.hview.displayedRegions,
        adapterConfig: args.adapterConfig,
      })
    ).regions
    args.view.vview.displayedRegions = (
      await renameRegionsIfNeeded(assemblyManager, {
        sessionId: args.sessionId,
        regions: args.view.vview.displayedRegions,
        adapterConfig: args.adapterConfig,
      })
    ).regions
    return args
  }
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
    const color = readConfObject(config, 'color')
    ctx.lineWidth = lineWidth
    ctx.scale(scale, scale)
    const [hview, vview] = views
    const db1 = hview.dynamicBlocks.contentBlocks[0].offsetPx
    const db2 = vview.dynamicBlocks.contentBlocks[0].offsetPx

    // we operate on snapshots of these attributes of the hview/vview because
    // it is significantly faster than accessing the mobx objects
    const { bpPerPx: hBpPerPx } = hview
    const { bpPerPx: vBpPerPx } = vview

    const hvsnap = {
      ...getSnapshot(hview),
      width: hview.width,
    }
    const vvsnap = {
      ...getSnapshot(vview),
      width: vview.width,
    }
    ctx.fillStyle = color
    ctx.strokeStyle = color
    hview.features?.forEach(feature => {
      let start = feature.get('start')
      let end = feature.get('end')
      const strand = feature.get('strand') || 1
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      const mateRef = mate.refName

      if (strand === -1) {
        ;[end, start] = [start, end]
      }

      const b10 = viewBpToPx({
        self: hvsnap,
        refName,
        coord: start,
      })?.offsetPx
      const b20 = viewBpToPx({
        self: hvsnap,
        refName,
        coord: end,
      })?.offsetPx
      const e10 = viewBpToPx({
        self: vvsnap,
        refName: mateRef,
        coord: mate.start,
      })?.offsetPx
      const e20 = viewBpToPx({
        self: vvsnap,
        refName: mateRef,
        coord: mate.end,
      })?.offsetPx
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
                currX += (val / hBpPerPx) * strand
                currY += val / vBpPerPx
              } else if (op === 'D' || op === 'N') {
                currX += (val / hBpPerPx) * strand
              } else if (op === 'I') {
                currY += val / vBpPerPx
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
