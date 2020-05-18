import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import BoxRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { bpSpanPx, iterMap } from '@gmod/jbrowse-core/util'
import { Region } from '@gmod/jbrowse-core/util/types'
import {
  createCanvas,
  createImageBitmap,
} from '@gmod/jbrowse-core/util/offscreenCanvasPonyfill'
import React from 'react'
import { BaseLayout } from '@gmod/jbrowse-core/util/layouts/BaseLayout'

import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { RenderArgsDeserialized } from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType'
import { lighten } from '@material-ui/core/styles/colorManipulator'
import { Mismatch } from '../BamAdapter/BamSlightlyLazyFeature'
import { sortFeature } from './sortUtil'

export interface PileupRenderProps {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  height: number
  width: number
  highResolutionScaling: number
  sortObject: {
    position: number
    by: string
  }
  showSoftClip: boolean
}

interface LayoutRecord {
  feature: Feature
  leftPx: number
  rightPx: number
  topPx: number
  heightPx: number
}

export default class PileupRenderer extends BoxRendererType {
  layoutFeature(
    feature: Feature,
    layout: BaseLayout<Feature>,
    config: AnyConfigurationModel,
    bpPerPx: number,
    region: Region,
    showSoftClip?: boolean,
  ): LayoutRecord | null {
    let expansionBefore = 0
    let expansionAfter = 0
    const mismatches: Mismatch[] = feature.get('mismatches')

    // alter the start and end below when softclipping enabled
    if (showSoftClip) {
      for (let i = 0; i < mismatches.length; i += 1) {
        const mismatch = mismatches[i]
        if (mismatch.type === 'softclip') {
          mismatch.start === 0
            ? (expansionBefore = mismatch.cliplen || 0)
            : (expansionAfter = mismatch.cliplen || 0)
        }
      }
    }

    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start') - expansionBefore,
      feature.get('end') + expansionAfter,
      region,
      bpPerPx,
    )

    let heightPx = readConfObject(config, 'height', [feature])
    const displayMode = readConfObject(config, 'displayMode', [feature])
    if (displayMode === 'compact') heightPx /= 3
    if (feature.get('refName') !== region.refName) {
      throw new Error(
        `feature ${feature.id()} is not on the current region's reference sequence ${
          region.refName
        }`,
      )
    }
    const topPx = layout.addRect(
      feature.id(),
      feature.get('start') - expansionBefore,
      feature.get('end') + expansionAfter,
      heightPx,
    )
    if (topPx === null) {
      return null
    }

    return {
      feature,
      leftPx,
      rightPx,
      topPx: displayMode === 'collapse' ? 0 : topPx,
      heightPx,
    }
  }

  // expands region for clipping to use
  // TODOCLIP continue working on expanding region larger if the default 100 isn't large enough
  getExpandedRegion(
    region: Region,
    renderArgs: RenderArgsDeserialized | PileupRenderProps,
    expansion?: number,
  ) {
    if (!region) return region
    const { bpPerPx, config, showSoftClip } = renderArgs
    const configClippingSize =
      config === undefined ? 0 : readConfObject(config, 'maxClippingSize')
    const maxClippingSize = expansion || configClippingSize
    if (!maxClippingSize || !showSoftClip) return region
    const bpExpansion = Math.round(maxClippingSize * bpPerPx)
    return {
      ...region,
      start: Math.floor(Math.max(region.start - bpExpansion, 0)),
      end: Math.ceil(region.end + bpExpansion),
    }
  }

  async makeImageData(props: PileupRenderProps) {
    const {
      features,
      layout,
      config,
      regions,
      bpPerPx,
      sortObject,
      highResolutionScaling = 1,
      showSoftClip,
    } = props
    const [region] = regions
    if (!layout) {
      throw new Error(`layout required`)
    }
    if (!layout.addRect) {
      throw new Error('invalid layout object')
    }
    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const w = Math.max(minFeatWidth, pxPerBp)

    const sortedFeatures =
      sortObject && sortObject.by && region.start === sortObject.position
        ? sortFeature(features, sortObject)
        : null

    const featureMap = sortedFeatures || features
    const layoutRecords = iterMap(
      featureMap.values(),
      feature =>
        this.layoutFeature(
          feature,
          layout,
          config,
          bpPerPx,
          region,
          showSoftClip,
        ),
      featureMap.size,
    )

    const width = (region.end - region.start) / bpPerPx
    const height = layout.getTotalHeight()
    if (!(width > 0) || !(height > 0))
      return { height: 0, width: 0, maxHeightReached: false }

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    ctx.font = 'bold 10px Courier New,monospace'
    const charSize = ctx.measureText('A')
    charSize.height = 7

    let maxClippingLength = readConfObject(config, 'maxClippingSize')

    layoutRecords.forEach(feat => {
      if (feat === null) {
        return
      }

      const { feature, leftPx, rightPx, topPx, heightPx } = feat
      ctx.fillStyle = readConfObject(config, 'color', [feature])
      ctx.fillRect(leftPx, topPx, Math.max(rightPx - leftPx, 1.5), heightPx)
      const mismatches: Mismatch[] =
        bpPerPx < 10 ? feature.get('mismatches') : feature.get('skips_and_dels')

      if (mismatches) {
        const colorForBase: { [key: string]: string } = {
          A: '#00bf00',
          C: '#4747ff',
          G: '#ffa500',
          T: '#f00',
          deletion: 'grey',
        }
        for (let i = 0; i < mismatches.length; i += 1) {
          const mismatch = mismatches[i]
          const [mismatchLeftPx, mismatchRightPx] = bpSpanPx(
            feature.get('start') + mismatch.start,
            feature.get('start') + mismatch.start + mismatch.length,
            region,
            bpPerPx,
          )
          const mismatchWidthPx = Math.max(
            minFeatWidth,
            Math.abs(mismatchLeftPx - mismatchRightPx),
          )

          if (mismatch.type === 'mismatch' || mismatch.type === 'deletion') {
            ctx.fillStyle =
              colorForBase[
                mismatch.type === 'deletion' ? 'deletion' : mismatch.base
              ] || '#888'
            ctx.fillRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)

            if (
              mismatchWidthPx >= charSize.width &&
              heightPx >= charSize.height - 5
            ) {
              ctx.fillStyle = mismatch.type === 'deletion' ? 'white' : 'black'
              ctx.fillText(
                mismatch.base,
                mismatchLeftPx + (mismatchWidthPx - charSize.width) / 2 + 1,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'insertion') {
            ctx.fillStyle = 'purple'
            const pos = mismatchLeftPx - 1
            ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
            if (
              mismatchWidthPx >= charSize.width &&
              heightPx >= charSize.height - 2
            ) {
              ctx.fillText(
                `(${mismatch.base})`,
                mismatchLeftPx + 2,
                topPx + heightPx,
              )
            }
          } else if (
            mismatch.type === 'hardclip' ||
            (!showSoftClip && mismatch.type === 'softclip')
          ) {
            ctx.fillStyle = mismatch.type === 'hardclip' ? 'red' : 'blue'
            const pos = mismatchLeftPx - 1
            ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
            if (
              mismatchWidthPx >= charSize.width &&
              heightPx >= charSize.height - 2
            ) {
              ctx.fillText(
                `(${mismatch.base})`,
                mismatchLeftPx + 2,
                topPx + heightPx,
              )
            }
          } else if (mismatch.type === 'skip') {
            ctx.clearRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)
            ctx.fillStyle = '#333'
            ctx.fillRect(
              mismatchLeftPx,
              topPx + heightPx / 2,
              mismatchWidthPx,
              2,
            )
          }
        }
        // Display all bases softclipped off in lightened colors
        if (showSoftClip) {
          for (let j = 0; j < mismatches.length; j += 1) {
            const mismatch = mismatches[j]
            if (mismatch.type === 'softclip') {
              const softClipLength = mismatch.cliplen || 0
              if (softClipLength > maxClippingLength) {
                maxClippingLength = softClipLength
                // this.getExpandedRegion(region, props, maxClippingLength)
                // need to use above return value to alter region somehow
              }
              const softClipStart =
                mismatch.start === 0
                  ? feature.get('start') - softClipLength
                  : feature.get('start') + mismatch.start
              for (let k = 0; k < softClipLength; k += 1) {
                const base = feature.get('seq').charAt(k + mismatch.start)
                // If softclip length+start is longer than sequence, no need to continue showing base
                if (!base) return

                const [softClipLeftPx, softClipRightPx] = bpSpanPx(
                  softClipStart + k,
                  softClipStart + k + 1,
                  region,
                  bpPerPx,
                )
                const softClipWidthPx = Math.max(
                  minFeatWidth,
                  Math.abs(softClipLeftPx - softClipRightPx),
                )

                // White accounts for IUPAC ambiguity code bases such as N that show in soft clipping
                ctx.fillStyle = lighten(colorForBase[base] || '#FFFFFF', 0.3)
                ctx.fillRect(softClipLeftPx, topPx, softClipWidthPx, heightPx)

                if (
                  softClipWidthPx >= charSize.width &&
                  heightPx >= charSize.height - 5
                ) {
                  ctx.fillStyle = 'black'
                  ctx.fillText(
                    base,
                    softClipLeftPx + (softClipWidthPx - charSize.width) / 2 + 1,
                    topPx + heightPx,
                  )
                }
              }
            }
          }
        }
      }
    })

    const imageData = await createImageBitmap(canvas)
    return {
      imageData,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }
  }

  async render(renderProps: PileupRenderProps) {
    const {
      height,
      width,
      imageData,
      maxHeightReached,
    } = await this.makeImageData(renderProps)
    const element = React.createElement(
      this.ReactComponent,
      {
        ...renderProps,
        region: renderProps.regions[0],
        height,
        width,
        imageData,
      },
      null,
    )

    return {
      element,
      imageData,
      height,
      width,
      maxHeightReached,
      layout: renderProps.layout,
    }
  }
}
