/* eslint-disable no-bitwise */
import deepEqual from 'deep-equal'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import BoxRendererType, {
  LayoutSession,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import MultiLayout from '@jbrowse/core/util/layouts/MultiLayout'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { bpSpanPx, iterMap } from '@jbrowse/core/util'
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
import { lighten } from '@material-ui/core/styles/colorManipulator'
import { Mismatch } from '../BamAdapter/MismatchParser'
import { sortFeature } from './sortUtil'

export interface PileupRenderProps {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  config: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  colorBy: {
    type: string
    tag?: string
    color?: string
    values?: [
      {
        value: number
        color: string
      },
    ]
  }
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

interface PileupLayoutSessionProps {
  config: AnyConfigurationModel
  bpPerPx: number
  filters: SerializableFilterChain
  sortedBy: unknown
  showSoftClip: unknown
}

type MyMultiLayout = MultiLayout<GranularRectLayout<unknown>, unknown>
interface CachedPileupLayout {
  layout: MyMultiLayout
  config: AnyConfigurationModel
  filters: SerializableFilterChain
  sortedBy: unknown
  showSoftClip: boolean
}

// orientation definitions from igv.js, see also https://software.broadinstitute.org/software/igv/interpreting_pair_orientations
const orientationTypes = {
  fr: {
    F1R2: 'LR',
    F2R1: 'LR',

    F1F2: 'LL',
    F2F1: 'LL',

    R1R2: 'RR',
    R2R1: 'RR',

    R1F2: 'RL',
    R2F1: 'RL',
  } as { [key: string]: string },

  rf: {
    R1F2: 'LR',
    R2F1: 'LR',

    R1R2: 'LL',
    R2R1: 'LL',

    F1F2: 'RR',
    F2F1: 'RR',

    F1R2: 'RL',
    F2R1: 'RL',
  } as { [key: string]: string },

  ff: {
    F2F1: 'LR',
    R1R2: 'LR',

    F2R1: 'LL',
    R1F2: 'LL',

    R2F1: 'RR',
    F1R2: 'RR',

    R2R1: 'RL',
    F1F2: 'RL',
  } as { [key: string]: string },
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

// Sorting and revealing soft clip changes the layout of Pileup renderer
// Adds extra conditions to see if cached layout is valid

class PileupLayoutSession extends LayoutSession {
  sortedBy: unknown

  showSoftClip = false

  constructor(args: PileupLayoutSessionProps) {
    super(args)
    this.config = args.config
  }

  cachedLayoutIsValid(cachedLayout: CachedPileupLayout) {
    return (
      super.cachedLayoutIsValid(cachedLayout) &&
      this.showSoftClip === cachedLayout.showSoftClip &&
      deepEqual(this.sortedBy, cachedLayout.sortedBy)
    )
  }

  cachedLayout: CachedPileupLayout | undefined

  get layout(): MyMultiLayout {
    if (!this.cachedLayout || !this.cachedLayoutIsValid(this.cachedLayout)) {
      this.cachedLayout = {
        layout: this.makeLayout(),
        config: readConfObject(this.config),
        filters: this.filters,
        sortedBy: this.sortedBy,
        showSoftClip: this.showSoftClip,
      }
    }
    return this.cachedLayout.layout
  }
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

    // Expand the start and end of feature when softclipping enabled
    if (showSoftClip && feature.get('seq')) {
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

  // expands region for clipping to use
  // In future when stats are improved, look for average read size in renderArg stats
  // and set that as the maxClippingSize/expand region by average read size
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

  colorByReverseTemplate(feature: Feature, _config: AnyConfigurationModel) {
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

  drawRect(
    ctx: CanvasRenderingContext2D,
    feat: {
      heightPx: number
      topPx: number
      feature: Feature
    },
    props: PileupRenderProps,
  ) {
    const { config, bpPerPx, regions, colorBy } = props
    const { heightPx, topPx, feature } = feat
    const region = regions[0]

    const colorMap = ['lightblue', 'pink', 'lightgreen', 'lightpurple']
    const colorType = colorBy ? colorBy.type : ''
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
      case 'reverseTemplate':
        ctx.fillStyle =
          alignmentColoring[this.colorByReverseTemplate(feature, config)]
        break
      case 'tag': {
        // right now is hardcoded
        // track should have information of what tags are on screen using the feature map
        // ask colin about colorscheme later
        // value of tag determines color
        // add custom menu option to drop down
        // on normal select and matches a tag we have a built in preset color for, it looks like [option chosen] [submit] (in dropdown have some sort of indicator that it has preset colors)
        // the ones that have preset colors will be hardcoded (like below)
        // on normal select and does not match a tag with a preset color, it looks like [option chosen] [set default color] [add value button] [submit]
        // on custom select it looks like
        // [custom] [enter custom name here] [set default color] [add value button] [submit]
        // if add value button pressed it looks like
        // [custom] [custom name] [default color] [submit]
        // [value] [color for value] [add value button]
        // add ellipses to end of Color by tag... menu option name to indicate something will open
        const tag = colorBy.tag as string
        const defaultColor = colorBy.color as string | undefined
        const isCram = feature.get('tags')
        if (tag === 'HP') {
          const val = isCram ? feature.get('tags')[tag] : feature.get(tag)
          ctx.fillStyle = colorMap[val]
        } else if (tag === 'XS' || tag === 'TS') {
          const map: { [key: string]: string | undefined } = {
            '-': 'color_rev_strand',
            '+': 'color_fwd_strand',
          }
          const val = isCram ? feature.get('tags')[tag] : feature.get(tag)
          ctx.fillStyle = alignmentColoring[map[val] || 'color_nostrand']
        }
        // tag is not predetermined, has a color that comes with it
        else {
          const val = isCram ? feature.get('tags')[tag] : feature.get(tag)
          const { values } = colorBy

          const foundColor = values.find(setVal => setVal.value === val)
          ctx.fillStyle = foundColor
            ? foundColor.color || defaultColor
            : 'color_nostrand'
        }
        break
      }
      // doesnt exist yet
      case 'insertSizeAndPairOrientation':
        // first color by pair, then in the pairs color by insert size
        break
      case 'normal':
      default:
        ctx.fillStyle = readConfObject(config, 'color', [feature])
        break
    }

    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
    )
    const flip = region.reversed ? -1 : 1
    const strand = feature.get('strand') * flip
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
    // ctx.fillRect(leftPx, topPx, Math.max(rightPx - leftPx, 1.5), heightPx)
  }

  drawMismatches(
    ctx: CanvasRenderingContext2D,
    feat: {
      heightPx: number
      topPx: number
      feature: Feature
    },
    mismatches: Mismatch[],
    props: PileupRenderProps,
    colorForBase: { [key: string]: string },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme: any,
  ) {
    const { config, bpPerPx, regions, showSoftClip } = props
    const [region] = regions
    const { heightPx, topPx, feature } = feat
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const charWidth = ctx.measureText('A').width
    const charHeight = ctx.measureText('M').width
    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const w = Math.max(minFeatWidth, pxPerBp)

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
        const baseColor =
          colorForBase[
            mismatch.type === 'deletion' ? 'deletion' : mismatch.base
          ] || '#888'
        ctx.fillStyle = baseColor
        ctx.fillRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)

        if (mismatchWidthPx >= charWidth && heightPx >= charHeight - 5) {
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
      } else if (
        mismatch.type === 'hardclip' ||
        (!showSoftClip && mismatch.type === 'softclip')
      ) {
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
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')

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
    const charWidth = ctx.measureText('A').width
    const charHeight = ctx.measureText('M').width
    layoutRecords.forEach(feat => {
      if (feat === null) {
        return
      }

      const { feature, topPx, heightPx } = feat

      ctx.fillStyle = readConfObject(config, 'color', [feature])
      this.drawRect(ctx, { feature, topPx, heightPx }, props)
      const mismatches: Mismatch[] = feature.get('mismatches')

      if (mismatches) {
        this.drawMismatches(ctx, feat, mismatches, props, colorForBase, theme)
        // Display all bases softclipped off in lightened colors
        if (showSoftClip) {
          const seq = feature.get('seq')
          if (!seq) {
            return
          }
          for (let j = 0; j < mismatches.length; j += 1) {
            const mismatch = mismatches[j]
            if (mismatch.type === 'softclip') {
              const softClipLength = mismatch.cliplen || 0
              const softClipStart =
                mismatch.start === 0
                  ? feature.get('start') - softClipLength
                  : feature.get('start') + mismatch.start
              for (let k = 0; k < softClipLength; k += 1) {
                const base = seq.charAt(k + mismatch.start)
                // If softclip length+start is longer than sequence, no need to
                // continue showing base
                if (!base) {
                  return
                }

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
                ctx.fillStyle = lighten(colorForBase[base] || '#000000', 0.3)
                ctx.fillRect(softClipLeftPx, topPx, softClipWidthPx, heightPx)

                if (
                  softClipWidthPx >= charWidth &&
                  heightPx >= charHeight - 5
                ) {
                  ctx.fillStyle = 'black'
                  ctx.fillText(
                    base,
                    softClipLeftPx + (softClipWidthPx - charWidth) / 2 + 1,
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

  createSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}
