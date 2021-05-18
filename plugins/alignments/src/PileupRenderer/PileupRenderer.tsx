import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { toArray } from 'rxjs/operators'
import BoxRendererType, {
  RenderArgs,
  RenderArgsSerialized,
  RenderArgsDeserialized as BoxRenderArgsDeserialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
} from '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType'
import { Theme } from '@material-ui/core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { bpSpanPx, iterMap } from '@jbrowse/core/util'
import Color from 'color'
import { Region } from '@jbrowse/core/util/types'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  Mismatch,
  parseCigar,
  getModificationPositions,
  getNextRefPos,
} from '../BamAdapter/MismatchParser'
import { sortFeature } from './sortUtil'
import { getTagAlt, orientationTypes } from '../util'

import {
  PileupLayoutSession,
  PileupLayoutSessionProps,
} from './PileupLayoutSession'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
}

function getColorBaseMap(theme: Theme) {
  return {
    A: theme.palette.bases.A.main,
    C: theme.palette.bases.C.main,
    G: theme.palette.bases.G.main,
    T: theme.palette.bases.T.main,
    deletion: '#808080', // gray
  }
}

export interface RenderArgsDeserialized extends BoxRenderArgsDeserialized {
  colorBy?: { type: string; tag?: string }
  colorTagMap?: Record<string, string>
  modificationTagMap?: Record<string, string>
  sortedBy?: {
    type: string
    pos: number
    refName: string
    assemblyName: string
    tag?: string
  }
  showSoftClip: boolean
  highResolutionScaling: number
}

export interface RenderArgsDeserializedWithFeaturesAndLayout
  extends RenderArgsDeserialized {
  features: Map<string, Feature>
  layout: BaseLayout<Feature>
  regionSequence?: string
}

interface LayoutRecord {
  feature: Feature
  leftPx: number
  rightPx: number
  topPx: number
  heightPx: number
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

function shouldDrawMismatches(type?: string) {
  return !['methylation', 'modifications'].includes(type || '')
}

export default class PileupRenderer extends BoxRendererType {
  supportsSVG = true

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
    const seq: string = feature.get('seq')

    // Expand the start and end of feature when softclipping enabled
    if (showSoftClip && seq) {
      for (let i = 0; i < mismatches.length; i += 1) {
        const { type, start, cliplen = 0 } = mismatches[i]
        if (type === 'softclip') {
          start === 0 ? (expansionBefore = cliplen) : (expansionAfter = cliplen)
        }
      }
    }

    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start') - expansionBefore,
      feature.get('end') + expansionAfter,
      region,
      bpPerPx,
    )

    let heightPx = readConfObject(config, 'height', { feature })
    const displayMode = readConfObject(config, 'displayMode', { feature })
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
  getExpandedRegion(region: Region, renderArgs: RenderArgsDeserialized) {
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
    const qual: string = feature.get('qual') || ''
    const scores = qual.split(' ').map(val => +val)
    const cigarOps = parseCigar(feature.get('CIGAR'))
    const width = 1 / bpPerPx
    const start = feature.get('start')

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
          const [leftPx] = bpSpanPx(
            start + j + m,
            start + j + m + 1,
            region,
            bpPerPx,
          )
          ctx.fillRect(leftPx, topPx, width + 0.5, heightPx)
        }
        j += len
      }
    }
  }

  // ML stores probabilities as array of numerics and MP is scaled phred scores
  // https://github.com/samtools/hts-specs/pull/418/files#diff-e765c6479316309f56b636f88189cdde8c40b854c7bdcce9ee7fe87a4e76febcR596
  //
  // if we have ML or Ml, it is an 8bit probability, divide by 255
  //
  // if we have MP or Mp it is phred scaled ASCII, which can go up to 90 but
  // has very high likelihood basecalls at that point, we really only care
  // about low qual calls <20 approx
  //
  colorByModifications(
    ctx: CanvasRenderingContext2D,
    layoutFeature: LayoutFeature,
    _config: AnyConfigurationModel,
    region: Region,
    bpPerPx: number,
    props: RenderArgsDeserializedWithFeaturesAndLayout,
  ) {
    const { feature, topPx, heightPx } = layoutFeature
    const { modificationTagMap = {} } = props

    const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''

    const ml = (getTagAlt(feature, 'ML', 'Ml') as number[] | string) || []

    const probabilities = ml
      ? (typeof ml === 'string' ? ml.split(',').map(e => +e) : ml).map(
          e => e / 255,
        )
      : (getTagAlt(feature, 'MP', 'Mp') as string)
          .split('')
          .map(s => s.charCodeAt(0) - 33)
          .map(elt => Math.min(1, elt / 50))

    const cigar = feature.get('CIGAR')
    const start = feature.get('start')
    const end = feature.get('end')
    const seq = feature.get('seq')
    const cigarOps = parseCigar(cigar)

    const modifications = getModificationPositions(mm, seq)

    // probIndex applies across multiple modifications e.g.
    let probIndex = 0
    modifications.forEach(({ type, positions }) => {
      const col = modificationTagMap[type] || 'black'
      const base = Color(col)
      for (const readPos of getNextRefPos(cigarOps, positions)) {
        if (readPos >= 0 && start + readPos < end) {
          const [leftPx, rightPx] = bpSpanPx(
            start + readPos,
            start + readPos + 1,
            region,
            bpPerPx,
          )

          // give it a little boost of 0.1 to not make them fully
          // invisible to avoid confusion
          ctx.fillStyle = base
            .alpha(probabilities[probIndex] + 0.1)
            .hsl()
            .string()
          ctx.fillRect(leftPx, topPx, rightPx - leftPx + 0.5, heightPx)
        }
        probIndex++
      }
    })
  }

  // Color by methylation is slightly modified version of color by
  // modifications
  //
  colorByMethylation(
    ctx: CanvasRenderingContext2D,
    layoutFeature: LayoutFeature,
    _config: AnyConfigurationModel,
    region: Region,
    bpPerPx: number,
    props: RenderArgsDeserializedWithFeaturesAndLayout,
  ) {
    const { regionSequence } = props
    const { feature, topPx, heightPx } = layoutFeature

    const mm: string = getTagAlt(feature, 'MM', 'Mm') || ''

    if (!regionSequence) {
      throw new Error('region sequence required for methylation')
    }

    const cigar = feature.get('CIGAR')
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const seq = feature.get('seq')
    const cigarOps = parseCigar(cigar)
    const { start: rstart, end: rend } = region

    const methBins = new Array(rend - rstart).fill(0)
    getModificationPositions(mm, seq).forEach(({ type, positions }) => {
      if (type === 'm' && positions) {
        for (const pos of getNextRefPos(cigarOps, positions)) {
          const epos = pos + fstart - rstart
          if (epos >= 0 && epos < methBins.length) {
            methBins[epos] = 1
          }
        }
      }
    })

    for (let j = fstart; j < fend; j++) {
      const i = j - rstart
      if (i >= 0 && i < methBins.length) {
        const l2 = regionSequence[i + 1]
        const l1 = regionSequence[i]
        // color
        if (l1.toUpperCase() === 'C' && l2.toUpperCase() === 'G') {
          const [leftPx, rightPx] = bpSpanPx(
            rstart + i,
            rstart + i + 1,
            region,
            bpPerPx,
          )
          if (methBins[i]) {
            ctx.fillStyle = 'red'
          } else {
            ctx.fillStyle = 'blue'
          }
          ctx.fillRect(leftPx, topPx, rightPx - leftPx + 0.5, heightPx)
        }
      }
    }
  }

  drawRect(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: RenderArgsDeserialized,
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
    props: RenderArgsDeserializedWithFeaturesAndLayout,
  ) {
    const { config, bpPerPx, regions, colorBy, colorTagMap = {} } = props
    const { tag = '', type: colorType = '' } = colorBy || {}
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
        ctx.fillStyle = readConfObject(config, 'color', { feature })
        break
    }

    this.drawRect(ctx, feat, props)

    // second pass for color types that render per-base things that go over the
    // existing drawing
    switch (colorType) {
      case 'perBaseQuality':
        this.colorByPerBaseQuality(ctx, feat, config, region, bpPerPx)
        break

      case 'modifications':
        this.colorByModifications(ctx, feat, config, region, bpPerPx, props)
        break

      case 'methylation':
        this.colorByMethylation(ctx, feat, config, region, bpPerPx, props)
        break
    }
  }

  drawMismatches(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: RenderArgsDeserializedWithFeaturesAndLayout,
    theme: Theme,
    colorForBase: { [key: string]: string },
    opts: {
      mismatchAlpha?: boolean
      drawSNPs?: boolean
      drawIndels?: boolean
    },
  ) {
    const { mismatchAlpha, drawSNPs = true, drawIndels = true } = opts
    const { config, bpPerPx, regions } = props
    const { heightPx, topPx, feature } = feat
    const { charWidth, charHeight } = this.getCharWidthHeight(ctx)
    const [region] = regions
    const start = feature.get('start')
    const minFeatWidth = readConfObject(config, 'minSubfeatureWidth')
    const insertionScale = readConfObject(
      config,
      'largeInsertionIndicatorScale',
    )
    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const w = Math.max(minFeatWidth, pxPerBp)
    const mismatches: Mismatch[] = feature.get('mismatches')
    const heightLim = charHeight - 2

    function getAlphaColor(baseColor: string, mismatch: { qual?: number }) {
      let color = baseColor
      if (mismatchAlpha && mismatch.qual !== undefined) {
        color = Color(baseColor)
          .alpha(Math.min(1, mismatch.qual / 50))
          .hsl()
          .string()
      }
      return color
    }

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
      if (mismatch.type === 'mismatch' && drawSNPs) {
        const baseColor = colorForBase[mismatch.base] || '#888'

        ctx.fillStyle = getAlphaColor(baseColor, mismatch)

        ctx.fillRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)

        if (mismatchWidthPx >= charWidth && heightPx >= heightLim) {
          // normal SNP coloring
          ctx.fillStyle = getAlphaColor(
            theme.palette.getContrastText(baseColor),
            mismatch,
          )
          ctx.fillText(
            mismatch.base,
            mismatchLeftPx + (mismatchWidthPx - charWidth) / 2 + 1,
            topPx + heightPx,
          )
        }
      } else if (mismatch.type === 'deletion' && drawIndels) {
        const baseColor = colorForBase.deletion
        ctx.fillStyle = baseColor
        ctx.fillRect(mismatchLeftPx, topPx, mismatchWidthPx, heightPx)
        if (mismatchWidthPx >= charWidth && heightPx >= heightLim) {
          ctx.fillStyle = theme.palette.getContrastText(baseColor)
          ctx.fillText(
            mismatch.base,
            mismatchLeftPx + (mismatchWidthPx - charWidth) / 2 + 1,
            topPx + heightPx,
          )
        }
      } else if (mismatch.type === 'insertion' && drawIndels) {
        ctx.fillStyle = 'purple'
        const pos = mismatchLeftPx - 1
        const len = +mismatch.base || mismatch.length
        if (len < 10) {
          ctx.fillRect(pos, topPx, w, heightPx)
          if (1 / bpPerPx >= charWidth) {
            ctx.fillRect(pos - w, topPx, w * 3, 1)
            ctx.fillRect(pos - w, topPx + heightPx - 1, w * 3, 1)
          }
          if (1 / bpPerPx >= charWidth && heightPx >= heightLim) {
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
        if (mismatchWidthPx >= charWidth && heightPx >= heightLim) {
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
          ctx.clearRect(
            mismatchLeftPx,
            topPx,
            // make small exons more visible when zoomed far out
            mismatchWidthPx - (bpPerPx > 10 ? 1.5 : 0),
            heightPx,
          )
        }
        ctx.fillStyle = '#333'
        ctx.fillRect(mismatchLeftPx, topPx + heightPx / 2, mismatchWidthPx, 2)
      }
    }

    // second pass, draw wide insertion markers on top
    if (drawIndels) {
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
          if (bpPerPx > insertionScale) {
            ctx.fillStyle = 'purple'
            ctx.fillRect(mismatchLeftPx - 1, topPx, 2, heightPx)
          } else if (heightPx > charHeight) {
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
          } else {
            const padding = 2
            ctx.fillStyle = 'purple'
            ctx.fillRect(mismatchLeftPx - padding, topPx, 2 * padding, heightPx)
          }
        }
      }
    }
  }

  drawSoftClipping(
    ctx: CanvasRenderingContext2D,
    feat: LayoutFeature,
    props: RenderArgsDeserializedWithFeaturesAndLayout,
    config: AnyConfigurationModel,
    theme: Theme,
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

  async makeImageData(
    ctx: CanvasRenderingContext2D,
    layoutRecords: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    props: RenderArgsDeserializedWithFeaturesAndLayout,
  ) {
    const { layout, config, showSoftClip, colorBy, theme: configTheme } = props
    const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
    const theme = createJBrowseTheme(configTheme)
    const colorForBase = getColorBaseMap(theme)
    if (!layout) {
      throw new Error(`layout required`)
    }
    if (!layout.addRect) {
      throw new Error('invalid layout object')
    }
    ctx.font = 'bold 10px Courier New,monospace'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layoutRecords.forEach((feat: any) => {
      if (feat === null) {
        return
      }

      const { feature, topPx, heightPx } = feat

      ctx.fillStyle = readConfObject(config, 'color', { feature })
      this.drawAlignmentRect(ctx, { feature, topPx, heightPx }, props)
      this.drawMismatches(ctx, feat, props, theme, colorForBase, {
        mismatchAlpha,

        drawSNPs: shouldDrawMismatches(colorBy?.type),
        drawIndels: shouldDrawMismatches(colorBy?.type),
      })
      if (showSoftClip) {
        this.drawSoftClipping(ctx, feat, props, config, theme)
      }
    })
  }

  // we perform a full layout before render as a separate method because the
  // layout determines the height of the canvas that we use to render
  layoutFeats(props: RenderArgsDeserializedWithFeaturesAndLayout) {
    const {
      layout,
      features,
      sortedBy,
      config,
      bpPerPx,
      showSoftClip,
      regions,
    } = props
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
    return layoutRecords
  }

  async render(renderProps: RenderArgsDeserialized) {
    const { bpPerPx, regions } = renderProps
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)

    const layoutRecords = this.layoutFeats({ ...renderProps, features, layout })

    // @ts-ignore
    const { dataAdapter: sequenceAdapter } = renderProps.adapterConfig
      .sequenceAdapter
      ? await getAdapter(
          this.pluginManager,
          renderProps.sessionId,
          // @ts-ignore
          renderProps.adapterConfig.sequenceAdapter,
        )
      : {}
    const [region] = regions
    const [feat] = sequenceAdapter
      ? await (sequenceAdapter as BaseFeatureDataAdapter)
          .getFeatures({
            start: region.start,
            end: region.end + 1,
            refName: region.refName,
            assemblyName: region.assemblyName,
          })
          .pipe(toArray())
          .toPromise()
      : []
    const regionSequence = feat?.get('seq')

    const width = (region.end - region.start) / bpPerPx
    const height = Math.max(layout.getTotalHeight(), 1)

    const res = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      (ctx: CanvasRenderingContext2D) =>
        this.makeImageData(ctx, layoutRecords, {
          ...renderProps,
          layout,
          features,
          regionSequence,
        }),
    )

    const results = await super.render({
      ...renderProps,
      ...res,
      features,
      layout,
      height,
      width,
    })

    return {
      ...results,
      ...res,
      features,
      layout,
      height,
      width,
      maxHeightReached: layout.maxHeightReached,
    }
  }

  createSession(args: PileupLayoutSessionProps) {
    return new PileupLayoutSession(args)
  }
}
