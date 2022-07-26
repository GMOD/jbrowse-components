import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import { renameRegionsIfNeeded, Region } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
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

    const { view, sessionId, adapterConfig } = args

    async function process(regions?: Region[]) {
      if (!assemblyManager) {
        throw new Error('No assembly manager provided')
      }
      const result = await renameRegionsIfNeeded(assemblyManager, {
        sessionId,
        adapterConfig,
        regions,
      })
      return result.regions
    }

    view.hview.displayedRegions = await process(view.hview.displayedRegions)
    view.vview.displayedRegions = await process(view.vview.displayedRegions)

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
    const isCallback = config.color.isCallback
    const posColor = readConfObject(config, 'posColor')
    const negColor = readConfObject(config, 'negColor')
    const colorBy = readConfObject(config, 'colorBy')
    const lineWidth = readConfObject(config, 'lineWidth')
    const thresholds = readConfObject(config, 'thresholds')
    const palette = readConfObject(config, 'thresholdsPalette')
    ctx.lineWidth = lineWidth
    ctx.scale(highResolutionScaling, highResolutionScaling)
    const [hview, vview] = views
    const db1 = hview.dynamicBlocks.contentBlocks[0].offsetPx
    const db2 = vview.dynamicBlocks.contentBlocks[0].offsetPx
    const unableToDraw = [] as string[]

    // we operate on snapshots of these attributes of the hview/vview because
    // it is significantly faster than accessing the mobx objects
    const { bpPerPx: hBpPerPx, width: hw, staticBlocks: hBlocks } = hview
    const { bpPerPx: vBpPerPx, width: vw, staticBlocks: vBlocks } = vview
    const hsnap = { ...getSnapshot(hview), staticBlocks: hBlocks, width: hw }
    const vsnap = { ...getSnapshot(hview), staticBlocks: vBlocks, width: vw }

    hview.features?.forEach(feature => {
      const strand = feature.get('strand') || 1
      const start = strand === 1 ? feature.get('start') : feature.get('end')
      const end = strand === 1 ? feature.get('end') : feature.get('start')
      const refName = feature.get('refName')
      const mate = feature.get('mate')
      const mateRef = mate.refName

      let r
      if (colorBy === 'identity') {
        for (let i = 0; i < thresholds.length; i++) {
          if (feature.get('identity') > +thresholds[i]) {
            r = palette[i]
            break
          }
        }
      } else if (colorBy === 'meanQueryIdentity') {
        r = `hsl(${feature.get('meanScore') * 200},100%,40%)`
      } else if (colorBy === 'mappingQuality') {
        r = `hsl(${feature.get('mappingQual')},100%,40%)`
      } else if (colorBy === 'strand') {
        r = strand === -1 ? negColor : posColor
      } else if (colorBy === 'default') {
        r = isCallback ? readConfObject(config, 'color', { feature }) : color
      }
      ctx.fillStyle = r
      ctx.strokeStyle = r

      const b10 = bpToPx({ self: hsnap, refName, coord: start })
      const b20 = bpToPx({ self: hsnap, refName, coord: end })
      const e10 = bpToPx({ self: vsnap, refName: mateRef, coord: mate.start })
      const e20 = bpToPx({ self: vsnap, refName: mateRef, coord: mate.end })
      if (
        b10 !== undefined &&
        b20 !== undefined &&
        e10 !== undefined &&
        e20 !== undefined
      ) {
        const b1 = b10.offsetPx - db1
        const b2 = b20.offsetPx - db1
        const e1 = e10.offsetPx - db2
        const e2 = e20.offsetPx - db2
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
