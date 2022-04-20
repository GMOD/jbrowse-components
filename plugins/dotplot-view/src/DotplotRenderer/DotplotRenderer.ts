import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { viewBpToPx, renameRegionsIfNeeded } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import { getSnapshot } from 'mobx-state-tree'
import ComparativeServerSideRendererType, {
  RenderArgsDeserialized as ComparativeRenderArgsDeserialized,
  RenderArgs as ComparativeRenderArgs,
} from '@jbrowse/core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { MismatchParser } from '@jbrowse/plugin-alignments'
import { Dotplot1DView, Dotplot1DViewModel } from '../DotplotView/model'

const { parseCigar } = MismatchParser

export interface DotplotRenderArgsDeserialized
  extends ComparativeRenderArgsDeserialized {
  height: number
  width: number
  highResolutionScaling: number
  view: {
    hview: Dotplot1DViewModel
    vview: Dotplot1DViewModel
  }
}

interface DotplotRenderArgs extends ComparativeRenderArgs {
  adapterConfig: AnyConfigurationModel
  sessionId: string
  view: {
    hview: { displayedRegions: Region[] }
    vview: { displayedRegions: Region[] }
  }
}

function drawCir(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fill = true,
  r = 1,
) {
  ctx.beginPath()
  ctx.arc(x, y, r / 2, 0, 2 * Math.PI)
  fill ? ctx.fill() : ctx.stroke()
}
export default class DotplotRenderer extends ComparativeServerSideRendererType {
  async renameRegionsIfNeeded(args: DotplotRenderArgs) {
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
  async makeImageData(
    props: DotplotRenderArgsDeserialized & { views: Dotplot1DViewModel[] },
  ) {
    const { highResolutionScaling = 1, width, height, config, views } = props

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const color = readConfObject(config, 'color')
    const posColor = readConfObject(config, 'posColor')
    const negColor = readConfObject(config, 'negColor')
    const colorBy = readConfObject(config, 'colorBy')
    const lineWidth = readConfObject(config, 'lineWidth')
    ctx.lineWidth = lineWidth
    ctx.scale(highResolutionScaling, highResolutionScaling)
    const [hview, vview] = views
    const db1 = hview.dynamicBlocks.contentBlocks[0].offsetPx
    const db2 = vview.dynamicBlocks.contentBlocks[0].offsetPx
    const unableToDraw = [] as string[]

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

      let r
      if (colorBy === 'identity') {
        const numMatches = feature.get('numMatches')
        const blockLen = feature.get('blockLen')
        const identity = numMatches / blockLen
        const thresholds = readConfObject(config, 'thresholds')
        const palette = readConfObject(config, 'thresholdsPalette')
        for (let i = 0; i < thresholds.length; i++) {
          if (identity > +thresholds[i]) {
            r = palette[i]
            break
          }
        }
      } else if (colorBy === 'mappingQuality') {
        const mq = feature.get('mappingQual')
        r = `hsl(${mq},50%,50%)`
      } else if (colorBy === 'strand') {
        r = strand === -1 ? negColor : posColor
      } else if (colorBy === 'default') {
        r = color
      } else if (colorBy === 'callback') {
        r = readConfObject(config, 'color', { feature })
      }
      ctx.fillStyle = r
      ctx.strokeStyle = r

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
        if (Math.abs(b1 - b2) <= 4 && Math.abs(e1 - e2) <= 4) {
          drawCir(ctx, b1, height - e1, true, lineWidth)
        } else {
          let currX = b1
          let currY = e1
          const cigar = feature.get('cg') || feature.get('CIGAR')

          if (cigar) {
            const cigarOps = parseCigar(cigar)

            ctx.beginPath()
            ctx.moveTo(currX, height - currY)
            for (let i = 0; i < cigarOps.length; i += 2) {
              const val = +cigarOps[i]
              const op = cigarOps[i + 1]
              if (op === 'M' || op === '=' || op === 'X') {
                currX += (val / hBpPerPx) * strand
                currY += val / vBpPerPx
              } else if (op === 'D' || op === 'N') {
                currX += (val / hBpPerPx) * strand
              } else if (op === 'I') {
                currY += val / vBpPerPx
              }
            }
            ctx.lineTo(currX, height - currY)
            ctx.stroke()
          } else {
            ctx.beginPath()
            ctx.moveTo(b1, height - e1)
            ctx.lineTo(b2, height - e2)
            ctx.stroke()
          }
        }
      } else {
        if (unableToDraw.length <= 5) {
          unableToDraw.push(
            `feature at ${refName}:${start}-${end} ${mateRef}:${mate.start}-${mate.end} not plotted, fell outside of range ${b10} ${b20} ${e10} ${e20}`,
          )
        }
      }
    })
    if (unableToDraw.length) {
      console.warn(
        (unableToDraw.length > 5
          ? 'Many features fell outside the boundaries of the contigs.....sample of features: '
          : 'Some features fell outside the boundaries of the contigs: ') +
          unableToDraw.slice(0, 5).join('\n'),
      )
    }
    return createImageBitmap(canvas)
  }

  async render(renderProps: DotplotRenderArgsDeserialized) {
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
    const target = realizedViews[0]
    const feats = await this.getFeatures({
      ...renderProps,
      regions: target.dynamicBlocks.contentBlocks,
    })
    target.setFeatures(feats)
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
