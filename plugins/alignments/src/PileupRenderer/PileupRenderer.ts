/* eslint-disable no-bitwise */
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import BoxRendererType from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { bpSpanPx, iterMap } from '@jbrowse/core/util'
import Color from 'color'
import { Region } from '@jbrowse/core/util/types'
import {
  createCanvas,
  createImageBitmap,
} from '@jbrowse/core/util/offscreenCanvasPonyfill'
import React from 'react'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'

import { readConfObject } from '@jbrowse/core/configuration'
import { RenderArgsDeserialized } from '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType'
import { ThemeOptions } from '@material-ui/core'
import { Mismatch, parseCigar } from '../BamAdapter/MismatchParser'
import { sortFeature } from './sortUtil'
import { orientationTypes } from './util'
import {
  PileupLayoutSession,
  PileupLayoutSessionProps,
} from './PileupLayoutSession'

export interface PileupRenderProps {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  colorBy?: {
    type: string
    tag?: string
  }
  colorTagMap?: { [key: string]: string }
  height: number
  width: number
  highResolutionScaling: number
  showSoftClip: boolean
  sortedBy: {
    type: string
    pos: number
    refName: string
  }
  theme: ThemeOptions
}

interface LayoutRecord {
  feature: Feature
  leftPx: number
  rightPx: number
  topPx: number
  heightPx: number
}

interface RenderArgsAugmented extends RenderArgsDeserialized {
  showSoftClip?: boolean
}

const alignmentColoring: { [key: string]: string } = {
  color_fwd_strand_not_proper: '#ECC8C8',
  color_rev_strand_not_proper: '#BEBED8',
  color_fwd_strand: '#EC8B8B',
  color_rev_strand: '#8F8FD8',
  color_fwd_missing_mate: '#D11919',
  color_rev_missing_mate: '#1919D1',
  color_fwd_diff_chr: '#000',
  color_rev_diff_chr: '#969696',
  color_pair_lr: '#c8c8c8',
  color_pair_rr: 'navy',
  color_pair_rl: 'teal',
  color_pair_ll: 'green',
  color_nostrand: '#999',
  color_interchrom: 'orange',
  color_longinsert: 'red',
  color_shortinsert: 'pink',
}

interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

export default class PileupRenderer extends BoxRendererType {
  // get width and height of chars the height is an approximation: width
  // letter M is approximately the height
  getCharWidthHeight(ctx: CanvasRenderingContext2D) {
    const charWidth = ctx.measureText('A').width
    const charHeight = ctx.measureText('M').width
    return { charWidth, charHeight }
  }

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
    const seq = feature.get('seq')

    // Expand the start and end of feature when softclipping enabled
    if (showSoftClip && seq) {
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
    if (displayMode === 'compact') {
      heightPx /= 3
    }
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

  // expands region for clipping to use. possible improvement: use average read
  // size to set the heuristic maxClippingSize expansion (e.g. short reads
  // don't have to expand a softclipping size a lot, but long reads might)
  getExpandedRegion(region: Region, renderArgs: RenderArgsAugmented) {
    const { config, showSoftClip } = renderArgs

    const maxClippingSize = readConfObject(config, 'maxClippingSize')
    const { start, end } = region
    const len = end - start
    const bpExpansion = Math.max(
      len,
      showSoftClip ? Math.round(maxClippingSize) : 0,
    )

    return {
      ...region,
      start: Math.floor(Math.max(start - bpExpansion, 0)),
      end: Math.ceil(end + bpExpansion),
    }
  }

  colorByOrientation(feature: Feature, config: AnyConfigurationModel) {
    return alignmentColoring[
      this.getOrientation(feature, config) || 'color_nostrand'
    ]
  }

  getOrientation(feature: Feature, config: AnyConfigurationModel) {
    const orientationType = readConfObject(config, 'orientationType') as
      | 'fr'
      | 'ff'
      | 'rf'
    const type = orientationTypes[orientationType]
    const orientation = type[feature.get('pair_orientation') as string]
    const map: { [key: string]: string } = {
      LR: 'color_pair_lr',
      RR: 'color_pair_rr',
      RL: 'color_pair_rl',
      LL: 'color_pair_ll',
    }
    return map[orientation]
  }

  colorByInsertSize(feature: Feature, _config: AnyConfigurationModel) {
    return feature.get('is_paired') &&
      feature.get('seq_id') !== feature.get('next_seq_id')
      ? '#555'
      : `hsl(${Math.abs(feature.get('template_length')) / 10},50%,50%)`
  }

  colorByStranded(feature: Feature, _config: AnyConfigurationModel) {
    const flags = feature.get('flags')
    const strand = feature.get('strand')
    // is paired
    if (flags & 1) {
      const revflag = flags & 64
      const flipper = revflag ? -1 : 1
      // proper pairing
      if (flags & 2) {
        return strand * flipper === 1 ? 'color_rev_strand' : 'color_fwd_strand'
      }
      if (feature.get('multi_segment_next_segment_unmapped')) {
        return strand * flipper === 1
          ? 'color_rev_missing_mate'
          : 'color_fwd_missing_mate'
      }
      if (feature.get('seq_id') === feature.get('next_seq_id')) {
        return strand * flipper === 1
          ? 'color_rev_strand_not_proper'
          : 'color_fwd_strand_not_proper'
      }
      // should only leave aberrant chr
      return strand === 1 ? 'color_fwd_diff_chr' : 'color_rev_diff_chr'
    }
    return strand === 1 ? 'color_fwd_strand' : 'color_rev_strand'
  }

  colorByPerBaseQuality(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    _config: AnyConfigurationModel,
    region: Region,
    bpPerPx: number,
  ) {
    const { feature, topPx, heightPx } = feat
    const qual = feature.get('qual') as string
    const scores = (qual || '').split(' ').map(val => +val)
    const cigarOps = parseCigar(feature.get('CIGAR'))
    const width = 1 / bpPerPx
    const [leftPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
    )

    for (let i = 0, j = 0, k = 0; k < scores.length; i += 2, k++) {
      const len = +cigarOps[i]
      const op = cigarOps[i + 1]
      if (op === 'S' || op === 'I') {
        k += len
      } else if (op === 'D' || op === 'N') {
        j += len
      } else if (op === 'M' || op === 'X' || op === '=') {
        for (let m = 0; m < len; m++) {
          const score = scores[k + m]
          ctx.fillStyle = `hsl(${score === 255 ? 150 : score * 1.5},55%,50%)`
          ctx.fillRect(leftPx + (j + m) * width, topPx, width + 0.5, heightPx)
        }
        j += len
      }
    }
  }

  drawRect(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: PileupRenderProps,
  ) {
    const { regions, bpPerPx } = props
    const { heightPx, topPx, feature } = feat
    const [region] = regions
    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
    )
    const flip = region.reversed ? -1 : 1
    const strand = feature.get('strand') * flip
    if (bpPerPx < 10) {
      if (strand === -1) {
        ctx.beginPath()
        ctx.moveTo(leftPx - 5, topPx + heightPx / 2)
        ctx.lineTo(leftPx, topPx + heightPx)
        ctx.lineTo(rightPx, topPx + heightPx)
        ctx.lineTo(rightPx, topPx)
        ctx.lineTo(leftPx, topPx)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(leftPx, topPx)
        ctx.lineTo(leftPx, topPx + heightPx)
        ctx.lineTo(rightPx, topPx + heightPx)
        ctx.lineTo(rightPx + 5, topPx + heightPx / 2)
        ctx.lineTo(rightPx, topPx)
        ctx.closePath()
        ctx.fill()
      }
    } else {
      ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
    }
  }

  drawAlignmentRect(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: PileupRenderProps,
  ) {
    const {
      config,
      bpPerPx,
      regions,
      colorBy: { tag = '', type: colorType = '' } = {},
      colorTagMap = {},
    } = props
    const { feature } = feat
    const region = regions[0]

    // first pass for simple color changes that change the color of the
    // alignment
    switch (colorType) {
      case 'insertSize':
        ctx.fillStyle = this.colorByInsertSize(feature, config)
        break
      case 'strand':
        ctx.fillStyle = feature.get('strand') === -1 ? '#8F8FD8' : '#EC8B8B'
        break
      case 'mappingQuality':
        ctx.fillStyle = `hsl(${feature.get('mq')},50%,50%)`
        break

      case 'pairOrientation':
        ctx.fillStyle = this.colorByOrientation(feature, config)
        break
      case 'stranded':
        ctx.fillStyle = alignmentColoring[this.colorByStranded(feature, config)]
        break
      case 'xs':
      case 'tag': {
        const tags = feature.get('tags')
        const val = tags ? tags[tag] : feature.get(tag)

        // special for for XS/TS tag
        if (tag === 'XS' || tag === 'TS') {
          const map: { [key: string]: string | undefined } = {
            '-': 'color_rev_strand',
            '+': 'color_fwd_strand',
          }
          ctx.fillStyle = alignmentColoring[map[val] || 'color_nostrand']
        }

        // lower case 'ts' from minimap2 is flipped from xs
        if (tag === 'ts') {
          const map: { [key: string]: string } = {
            '-':
              feature.get('strand') === -1
                ? 'color_fwd_strand'
                : 'color_rev_strand',
            '+':
              feature.get('strand') === -1
                ? 'color_rev_strand'
                : 'color_fwd_strand',
          }
          ctx.fillStyle = alignmentColoring[map[val] || 'color_nostrand']
        }

        // tag is not one of the autofilled tags, has color-value pairs from
        // fetchValues
        else {
          const foundValue = colorTagMap[val]
          ctx.fillStyle = foundValue || 'color_nostrand'
        }
        break
      }
      case 'insertSizeAndPairOrientation':
        break

      case 'normal':
      default:
        ctx.fillStyle = readConfObject(config, 'color', [feature])
        break
    }

    this.drawRect(ctx, feat, props)

    // second pass for color types that render per-base things that go over the
    // existing drawing
    switch (colorType) {
      case 'perBaseQuality':
        this.colorByPerBaseQuality(ctx, feat, config, region, bpPerPx)
        break
    }
  }

  drawMismatches(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: PileupRenderProps,
    mismatchQuality: boolean,
    colorForBase: { [key: string]: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme: any,
  ) {
    const { config, bpPerPx, regions } = props
    const { heightPx, topPx, feature } = feat
    const { charWidth, charHeight } = this.getCharWidthHeight(ctx)
    const [region] = regions
    const start = feature.get('start')
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const w = Math.max(minFeatWidth, pxPerBp)
    const mismatches: Mismatch[] = feature.get('mismatches')

    // two pass rendering: first pass, draw all the mismatches except wide
    // insertion markers
    for (let i = 0; i < mismatches.length; i += 1) {
      const mismatch = mismatches[i]
      const [mismatchLeftPx, mismatchRightPx] = bpSpanPx(
        start + mismatch.start,
        start + mismatch.start + mismatch.length,
        region,
        bpPerPx,
      )
      const mismatchWidthPx = Math.max(
        minFeatWidth,
        Math.abs(mismatchLeftPx - mismatchRightPx),
      )

      if (mismatch.type === 'mismatch' || mismatch.type === 'deletion') {
        const baseColor =
          colorForBase[
            mismatch.type === 'deletion' ? 'deletion' : mismatch.base
          ] || '#888'

        let color = baseColor
        if (mismatchQuality && mismatch.qual !== undefined) {
          color = Color(baseColor)
            .alpha(mismatch.qual / 90)
            .hsl()
            .string()
        }
        ctx.fillStyle = color

        ctx.fillRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)

        if (mismatchWidthPx >= charWidth && heightPx >= charHeight - 5) {
          // normal SNP coloring
          ctx.fillStyle = theme.palette.getContrastText(baseColor)
          ctx.fillText(
            mismatch.base,
            mismatchLeftPx + (mismatchWidthPx - charWidth) / 2 + 1,
            topPx + heightPx,
          )
        }
      } else if (mismatch.type === 'insertion') {
        ctx.fillStyle = 'purple'
        const pos = mismatchLeftPx - 1

        const len = +mismatch.base || mismatch.length

        if (len < 10) {
          ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
          ctx.fillRect(pos - w, topPx, w * 3, 1)
          ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
          if (1 / bpPerPx >= charWidth && heightPx >= charHeight - 2) {
            ctx.fillText(
              `(${mismatch.base})`,
              mismatchLeftPx + 2,
              topPx + heightPx,
            )
          }
        }
      } else if (mismatch.type === 'hardclip' || mismatch.type === 'softclip') {
        ctx.fillStyle = mismatch.type === 'hardclip' ? 'red' : 'blue'
        const pos = mismatchLeftPx - 1
        ctx.fillRect(pos, topPx + 1, w, heightPx - 2)
        ctx.fillRect(pos - w, topPx, w * 3, 1)
        ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
        if (mismatchWidthPx >= charWidth && heightPx >= charHeight - 2) {
          ctx.fillText(
            `(${mismatch.base})`,
            mismatchLeftPx + 2,
            topPx + heightPx,
          )
        }
      } else if (mismatch.type === 'skip') {
        // fix to avoid bad rendering
        // note that this was also related to chrome bug https://bugs.chromium.org/p/chro>
        // ref #1236
        if (mismatchLeftPx + mismatchWidthPx > 0) {
          ctx.clearRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)
        }
        ctx.fillStyle = '#333'
        ctx.fillRect(mismatchLeftPx, topPx + heightPx / 2, mismatchWidthPx, 2)
      }
    }

    // second pass, draw wide insertion markers on top
    for (let i = 0; i < mismatches.length; i += 1) {
      const mismatch = mismatches[i]
      const [mismatchLeftPx] = bpSpanPx(
        feature.get('start') + mismatch.start,
        feature.get('start') + mismatch.start + mismatch.length,
        region,
        bpPerPx,
      )
      const len = +mismatch.base || mismatch.length
      const txt = `${len}`
      if (mismatch.type === 'insertion' && len >= 10) {
        const rect = ctx.measureText(txt)
        const padding = 5
        ctx.fillStyle = 'purple'
        ctx.fillRect(
          mismatchLeftPx - rect.width / 2 - padding,
          topPx,
          rect.width + 2 * padding,
          heightPx,
        )
        ctx.fillStyle = 'white'
        ctx.fillText(txt, mismatchLeftPx - rect.width / 2, topPx + heightPx)
      }
    }
  }

  drawSoftClipping(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: PileupRenderProps,
    config: AnyConfigurationModel,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme: any,
  ) {
    const { feature, topPx, heightPx } = feat
    const { regions, bpPerPx } = props
    const [region] = regions
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const mismatches: Mismatch[] = feature.get('mismatches')
    const seq = feature.get('seq')
    const { charWidth, charHeight } = this.getCharWidthHeight(ctx)
    const colorForBase: { [key: string]: string } = {
      A: theme.palette.bases.A.main,
      C: theme.palette.bases.C.main,
      G: theme.palette.bases.G.main,
      T: theme.palette.bases.T.main,
      deletion: '#808080', // gray
    }

    // Display all bases softclipped off in lightened colors
    if (seq) {
      mismatches
        .filter(mismatch => mismatch.type === 'softclip')
        .forEach(mismatch => {
          const softClipLength = mismatch.cliplen || 0
          const softClipStart =
            mismatch.start === 0
              ? feature.get('start') - softClipLength
              : feature.get('start') + mismatch.start

          for (let k = 0; k < softClipLength; k += 1) {
            const base = seq.charAt(k + mismatch.start)

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

            // Black accounts for IUPAC ambiguity code bases such as N that
            // show in soft clipping
            const baseColor = colorForBase[base] || '#000000'
            ctx.fillStyle = baseColor
            ctx.fillRect(softClipLeftPx, topPx, softClipWidthPx, heightPx)

            if (softClipWidthPx >= charWidth && heightPx >= charHeight - 5) {
              ctx.fillStyle = theme.palette.getContrastText(baseColor)
              ctx.fillText(
                base,
                softClipLeftPx + (softClipWidthPx - charWidth) / 2 + 1,
                topPx + heightPx,
              )
            }
          }
        })
    }
  }

  async makeImageData(props: PileupRenderProps) {
    const {
      features,
      layout,
      config,
      regions,
      bpPerPx,
      sortedBy,
      highResolutionScaling = 1,
      showSoftClip,
      colorBy = {} as { type?: string },
      theme: configTheme,
    } = props
    const theme = createJBrowseTheme(configTheme)
    const colorForBase: { [key: string]: string } = {
      A: theme.palette.bases.A.main,
      C: theme.palette.bases.C.main,
      G: theme.palette.bases.G.main,
      T: theme.palette.bases.T.main,
      deletion: '#808080', // gray
    }
    const [region] = regions
    if (!layout) {
      throw new Error(`layout required`)
    }
    if (!layout.addRect) {
      throw new Error('invalid layout object')
    }

    const sortedFeatures =
      sortedBy && sortedBy.type && region.start === sortedBy.pos
        ? sortFeature(features, sortedBy)
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
    const height = Math.max(layout.getTotalHeight(), 1)

    const canvas = createCanvas(
      Math.ceil(width * highResolutionScaling),
      height * highResolutionScaling,
    )
    const ctx = canvas.getContext('2d')
    ctx.scale(highResolutionScaling, highResolutionScaling)
    ctx.font = 'bold 10px Courier New,monospace'
    layoutRecords.forEach(feat => {
      if (feat === null) {
        return
      }

      const { feature, topPx, heightPx } = feat

      ctx.fillStyle = readConfObject(config, 'color', [feature])
      this.drawAlignmentRect(ctx, { feature, topPx, heightPx }, props)
      this.drawMismatches(
        ctx,
        feat,
        props,
        colorBy.type === 'mismatchQuality',
        colorForBase,
        theme,
      )
      if (showSoftClip) {
        this.drawSoftClipping(ctx, feat, props, config, theme)
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

  createSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}
