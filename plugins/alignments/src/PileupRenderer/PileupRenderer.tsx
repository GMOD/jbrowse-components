import Color from 'color'
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
import {
  bpSpanPx,
  iterMap,
  measureText,
  Region,
  Feature,
} from '@jbrowse/core/util'
import { renderToAbstractCanvas } from '@jbrowse/core/util/offscreenCanvasUtils'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'

// locals
import {
  Mismatch,
  parseCigar,
  getModificationPositions,
  getNextRefPos,
} from '../BamAdapter/MismatchParser'
import { sortFeature } from './sortUtil'
import {
  getTagAlt,
  orientationTypes,
  fetchSequence,
  shouldFetchReferenceSequence,
} from '../util'
import {
  PileupLayoutSession,
  PileupLayoutSessionProps,
} from './PileupLayoutSession'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

function fillRect(
  ctx: CanvasRenderingContext2D,
  l: number,
  t: number,
  w: number,
  h: number,
  cw: number,
  color?: string,
) {
  if (l + w < 0 || l > cw) {
    return
  } else {
    if (color) {
      ctx.fillStyle = color
    }
    ctx.fillRect(l, t, w, h)
  }
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

function getContrastBaseMap(theme: Theme) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(theme)).map(([key, value]) => [
      key,
      theme.palette.getContrastText(value),
    ]),
  )
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
  color_nostrand: '#c8c8c8',
  color_interchrom: 'orange',
  color_longinsert: 'red',
  color_shortinsert: 'pink',
}

interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

function shouldDrawSNPs(type?: string) {
  return !['methylation', 'modifications'].includes(type || '')
}

function shouldDrawIndels(type?: string) {
  return true
}

export default class PileupRenderer extends BoxRendererType {
  supportsSVG = true

  // get width and height of chars the height is an approximation: width
  // letter M is approximately the height
  getCharWidthHeight(ctx: CanvasRenderingContext2D) {
    const charWidth = measureText('A')
    const charHeight = measureText('M')
    return { charWidth, charHeight }
  }

  layoutFeature({
    feature,
    layout,
    bpPerPx,
    region,
    showSoftClip,
    heightPx,
    displayMode,
  }: {
    feature: Feature
    layout: BaseLayout<Feature>
    bpPerPx: number
    region: Region
    showSoftClip?: boolean
    heightPx: number
    displayMode: string
  }): LayoutRecord | null {
    let expansionBefore = 0
    let expansionAfter = 0

    // Expand the start and end of feature when softclipping enabled
    if (showSoftClip) {
      const mismatches = feature.get('mismatches') as Mismatch[]
      const seq = feature.get('seq') as string
      if (seq) {
        for (let i = 0; i < mismatches.length; i += 1) {
          const { type, start, cliplen = 0 } = mismatches[i]
          if (type === 'softclip') {
            start === 0
              ? (expansionBefore = cliplen)
              : (expansionAfter = cliplen)
          }
        }
      }
    }

    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start') - expansionBefore,
      feature.get('end') + expansionAfter,
      region,
      bpPerPx,
    )

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
      feature,
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

  colorByPerBaseLettering({
    ctx,
    feat,
    region,
    bpPerPx,
    colorForBase,
    contrastForBase,
    charWidth,
    charHeight,
    canvasWidth,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    region: Region
    bpPerPx: number
    colorForBase: Record<string, string>
    contrastForBase: Record<string, string>
    charWidth: number
    charHeight: number
    canvasWidth: number
  }) {
    const heightLim = charHeight - 2
    const { feature, topPx, heightPx } = feat
    const seq = feature.get('seq') as string
    const cigarOps = parseCigar(feature.get('CIGAR'))
    const w = 1 / bpPerPx
    const start = feature.get('start')
    let soffset = 0 // sequence offset
    let roffset = 0 // reference offset

    for (let i = 0; i < cigarOps.length; i += 2) {
      const len = +cigarOps[i]
      const op = cigarOps[i + 1]
      if (op === 'S' || op === 'I') {
        soffset += len
      } else if (op === 'D' || op === 'N') {
        roffset += len
      } else if (op === 'M' || op === 'X' || op === '=') {
        for (let m = 0; m < len; m++) {
          const letter = seq[soffset + m]
          const r = start + roffset + m
          const [leftPx] = bpSpanPx(r, r + 1, region, bpPerPx)
          fillRect(
            ctx,
            leftPx,
            topPx,
            w + 0.5,
            heightPx,
            canvasWidth,
            colorForBase[letter],
          )

          if (w >= charWidth && heightPx >= heightLim) {
            // normal SNP coloring
            ctx.fillStyle = contrastForBase[letter]

            ctx.fillText(
              letter,
              leftPx + (w - charWidth) / 2 + 1,
              topPx + heightPx,
            )
          }
        }
        soffset += len
        roffset += len
      }
    }
  }
  colorByPerBaseQuality({
    ctx,
    feat,
    region,
    bpPerPx,
    canvasWidth,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    region: Region
    bpPerPx: number
    canvasWidth: number
  }) {
    const { feature, topPx, heightPx } = feat
    const qual: string = feature.get('qual') || ''
    const scores = qual.split(' ').map(val => +val)
    const cigarOps = parseCigar(feature.get('CIGAR'))
    const width = 1 / bpPerPx
    const start = feature.get('start')
    let soffset = 0 // sequence offset
    let roffset = 0 // reference offset

    for (let i = 0; i < cigarOps.length; i += 2) {
      const len = +cigarOps[i]
      const op = cigarOps[i + 1]
      if (op === 'S' || op === 'I') {
        soffset += len
      } else if (op === 'D' || op === 'N') {
        roffset += len
      } else if (op === 'M' || op === 'X' || op === '=') {
        for (let m = 0; m < len; m++) {
          const score = scores[soffset + m]
          const [leftPx] = bpSpanPx(
            start + roffset + m,
            start + roffset + m + 1,
            region,
            bpPerPx,
          )
          fillRect(
            ctx,
            leftPx,
            topPx,
            width + 0.5,
            heightPx,
            canvasWidth,
            `hsl(${score === 255 ? 150 : score * 1.5},55%,50%)`,
          )
        }
        soffset += len
        roffset += len
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
  colorByModifications({
    ctx,
    feat,
    region,
    bpPerPx,
    renderArgs,
    canvasWidth,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    region: Region
    bpPerPx: number
    renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
    canvasWidth: number
  }) {
    const { feature, topPx, heightPx } = feat
    const { modificationTagMap = {} } = renderArgs

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
    const seq = feature.get('seq')
    const strand = feature.get('strand')
    const cigarOps = parseCigar(cigar)

    const modifications = getModificationPositions(mm, seq, strand)

    // probIndex applies across multiple modifications e.g.
    let probIndex = 0
    for (let i = 0; i < modifications.length; i++) {
      const { type, positions } = modifications[i]
      const col = modificationTagMap[type] || 'black'
      const base = Color(col)
      for (const readPos of getNextRefPos(cigarOps, positions)) {
        const r = start + readPos
        const [leftPx, rightPx] = bpSpanPx(r, r + 1, region, bpPerPx)

        // give it a little boost of 0.1 to not make them fully
        // invisible to avoid confusion
        const prob = probabilities[probIndex]

        fillRect(
          ctx,
          leftPx,
          topPx,
          rightPx - leftPx + 0.5,
          heightPx,
          canvasWidth,
          prob && prob !== 1
            ? base
                .alpha(prob + 0.1)
                .hsl()
                .string()
            : col,
        )
        probIndex++
      }
    }
  }

  // Color by methylation is slightly modified version of color by
  // modifications that focuses on CpG sites, with non-methylated CpG colored
  // blue
  colorByMethylation({
    ctx,
    feat,
    region,
    bpPerPx,
    renderArgs,
    canvasWidth,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    region: Region
    bpPerPx: number
    renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
    canvasWidth: number
  }) {
    const { regionSequence } = renderArgs
    const { feature, topPx, heightPx } = feat

    const mm: string = getTagAlt(feature, 'MM', 'Mm') || ''

    if (!regionSequence) {
      throw new Error('region sequence required for methylation')
    }

    const cigar = feature.get('CIGAR')
    const fstart = feature.get('start')
    const fend = feature.get('end')
    const seq = feature.get('seq')
    const strand = feature.get('strand')
    const cigarOps = parseCigar(cigar)

    const methBins = new Array(region.end - region.start).fill(0)
    const modifications = getModificationPositions(mm, seq, strand)
    for (let i = 0; i < modifications.length; i++) {
      const { type, positions } = modifications[i]
      if (type === 'm' && positions) {
        for (const pos of getNextRefPos(cigarOps, positions)) {
          const epos = pos + fstart - region.start
          if (epos >= 0 && epos < methBins.length) {
            methBins[epos] = 1
          }
        }
      }
    }

    for (let j = fstart; j < fend; j++) {
      const i = j - region.start
      if (i >= 0 && i < methBins.length) {
        const l1 = regionSequence[i].toLowerCase()
        const l2 = regionSequence[i + 1].toLowerCase()

        // if we are zoomed out, display just a block over the cpg
        if (bpPerPx > 2) {
          if (l1 === 'c' && l2 === 'g') {
            const s = region.start + i
            const [leftPx, rightPx] = bpSpanPx(s, s + 2, region, bpPerPx)
            fillRect(
              ctx,
              leftPx,
              topPx,
              rightPx - leftPx + 0.5,
              heightPx,
              canvasWidth,
              methBins[i] || methBins[i + 1] ? 'red' : 'blue',
            )
          }
        }
        // if we are zoomed in, color the c inside the cpg
        else {
          // color
          if (l1 === 'c' && l2 === 'g') {
            const s = region.start + i
            const [leftPx, rightPx] = bpSpanPx(s, s + 1, region, bpPerPx)
            fillRect(
              ctx,
              leftPx,
              topPx,
              rightPx - leftPx + 0.5,
              heightPx,
              canvasWidth,
              methBins[i] ? 'red' : 'blue',
            )

            const [leftPx2, rightPx2] = bpSpanPx(s + 1, s + 2, region, bpPerPx)
            fillRect(
              ctx,
              leftPx2,
              topPx,
              rightPx2 - leftPx2 + 0.5,
              heightPx,
              canvasWidth,
              methBins[i + 1] ? 'red' : 'blue',
            )
          }
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

  drawAlignmentRect({
    ctx,
    feat,
    renderArgs,
    colorForBase,
    contrastForBase,
    charWidth,
    charHeight,
    defaultColor,
    canvasWidth,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
    colorForBase: Record<string, string>
    contrastForBase: Record<string, string>
    charWidth: number
    charHeight: number
    defaultColor: boolean
    canvasWidth: number
  }) {
    const { config, bpPerPx, regions, colorBy, colorTagMap = {} } = renderArgs

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
          ctx.fillStyle = foundValue || alignmentColoring['color_nostrand']
        }
        break
      }
      case 'insertSizeAndPairOrientation':
        break

      case 'modifications':
      case 'methylation':
        // this coloring is similar to igv.js, and is helpful to color negative
        // strand reads differently because their c-g will be flipped (e.g. g-c
        // read right to left)
        if (feature.get('flags') & 16) {
          ctx.fillStyle = '#c8dcc8'
        } else {
          ctx.fillStyle = '#c8c8c8'
        }
        break

      case 'normal':
      default:
        if (defaultColor) {
          // avoid a readConfObject call here
          ctx.fillStyle = '#c8c8c8'
        } else {
          ctx.fillStyle = readConfObject(config, 'color', { feature })
        }
        break
    }

    this.drawRect(ctx, feat, renderArgs)

    // second pass for color types that render per-base things that go over the
    // existing drawing
    switch (colorType) {
      case 'perBaseQuality':
        this.colorByPerBaseQuality({
          ctx,
          feat,
          region,
          bpPerPx,
          canvasWidth,
        })
        break

      case 'perBaseLettering':
        this.colorByPerBaseLettering({
          ctx,
          feat,
          region,
          bpPerPx,
          colorForBase,
          contrastForBase,
          charWidth,
          charHeight,
          canvasWidth,
        })
        break

      case 'modifications':
        this.colorByModifications({
          ctx,
          feat,
          region,
          bpPerPx,
          renderArgs,
          canvasWidth,
        })
        break

      case 'methylation':
        this.colorByMethylation({
          ctx,
          feat,
          region,
          bpPerPx,
          renderArgs,
          canvasWidth,
        })
        break
    }
  }

  drawMismatches({
    ctx,
    feat,
    renderArgs,
    minSubfeatureWidth,
    largeInsertionIndicatorScale,
    mismatchAlpha,
    charWidth,
    charHeight,
    colorForBase,
    contrastForBase,
    canvasWidth,
    drawSNPs = true,
    drawIndels = true,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
    colorForBase: { [key: string]: string }
    contrastForBase: { [key: string]: string }
    mismatchAlpha?: boolean
    drawSNPs?: boolean
    drawIndels?: boolean
    minSubfeatureWidth: number
    largeInsertionIndicatorScale: number
    charWidth: number
    charHeight: number
    canvasWidth: number
  }) {
    const { bpPerPx, regions } = renderArgs
    const { heightPx, topPx, feature } = feat
    const [region] = regions
    const start = feature.get('start')

    const pxPerBp = Math.min(1 / bpPerPx, 2)
    const w = Math.max(minSubfeatureWidth, pxPerBp)
    const mismatches: Mismatch[] = feature.get('mismatches')
    const heightLim = charHeight - 2

    // extraHorizontallyFlippedOffset is used to draw interbase items, which
    // are located to the left when forward and right when reversed
    const extraHorizontallyFlippedOffset = region.reversed
      ? 1 / bpPerPx + 1
      : -1

    // two pass rendering: first pass, draw all the mismatches except wide
    // insertion markers
    for (let i = 0; i < mismatches.length; i += 1) {
      const mismatch = mismatches[i]
      const mstart = start + mismatch.start
      const mlen = mismatch.length
      const mbase = mismatch.base
      const [leftPx, rightPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
      const widthPx = Math.max(minSubfeatureWidth, Math.abs(leftPx - rightPx))
      if (mismatch.type === 'mismatch' && drawSNPs) {
        const baseColor = colorForBase[mismatch.base] || '#888'

        fillRect(
          ctx,
          leftPx,
          topPx,
          widthPx,
          heightPx,
          canvasWidth,
          !mismatchAlpha
            ? baseColor
            : mismatch.qual !== undefined
            ? Color(baseColor)
                .alpha(Math.min(1, mismatch.qual / 50))
                .hsl()
                .string()
            : baseColor,
        )

        if (widthPx >= charWidth && heightPx >= heightLim) {
          // normal SNP coloring
          const contrastColor = contrastForBase[mismatch.base] || 'black'
          ctx.fillStyle = !mismatchAlpha
            ? contrastColor
            : mismatch.qual !== undefined
            ? Color(contrastColor)
                .alpha(Math.min(1, mismatch.qual / 50))
                .hsl()
                .string()
            : contrastColor
          ctx.fillText(
            mbase,
            leftPx + (widthPx - charWidth) / 2 + 1,
            topPx + heightPx,
          )
        }
      } else if (mismatch.type === 'deletion' && drawIndels) {
        fillRect(
          ctx,
          leftPx,
          topPx,
          widthPx,
          heightPx,
          canvasWidth,
          colorForBase.deletion,
        )
        const txt = `${mismatch.length}`
        const rwidth = measureText(txt, 10)
        if (widthPx >= rwidth && heightPx >= heightLim) {
          ctx.fillStyle = contrastForBase.deletion
          ctx.fillText(
            txt,
            (leftPx + rightPx) / 2 - rwidth / 2,
            topPx + heightPx,
          )
        }
      } else if (mismatch.type === 'insertion' && drawIndels) {
        ctx.fillStyle = 'purple'
        const pos = leftPx + extraHorizontallyFlippedOffset
        const len = +mismatch.base || mismatch.length
        const insW = Math.max(
          minSubfeatureWidth / 2,
          Math.min(1.2, 1 / bpPerPx),
        )
        if (len < 10) {
          fillRect(ctx, pos, topPx, insW, heightPx, canvasWidth, 'purple')
          if (1 / bpPerPx >= charWidth && heightPx >= heightLim) {
            fillRect(ctx, pos - insW, topPx, insW * 3, 1, canvasWidth)
            fillRect(
              ctx,
              pos - insW,
              topPx + heightPx - 1,
              insW * 3,
              1,
              canvasWidth,
            )
            ctx.fillText(`(${mismatch.base})`, pos + 3, topPx + heightPx)
          }
        }
      } else if (mismatch.type === 'hardclip' || mismatch.type === 'softclip') {
        const pos = leftPx + extraHorizontallyFlippedOffset
        fillRect(
          ctx,
          pos,
          topPx,
          w,
          heightPx,
          canvasWidth,
          mismatch.type === 'hardclip' ? 'red' : 'blue',
        )
        if (1 / bpPerPx >= charWidth && heightPx >= heightLim) {
          fillRect(ctx, pos - w, topPx, w * 3, 1, canvasWidth)
          fillRect(ctx, pos - w, topPx + heightPx - 1, w * 3, 1, canvasWidth)
          ctx.fillText(`(${mismatch.base})`, pos + 3, topPx + heightPx)
        }
      } else if (mismatch.type === 'skip') {
        // fix to avoid bad rendering note that this was also related to chrome
        // bug https://bugs.chromium.org/p/chromium/issues/detail?id=1131528
        // also affected firefox ref #1236 #2750
        if (leftPx + widthPx > 0) {
          // make small exons more visible when zoomed far out
          const adjustPx = widthPx - (bpPerPx > 10 ? 1.5 : 0)
          ctx.clearRect(leftPx, topPx, adjustPx, heightPx)
          fillRect(
            ctx,
            Math.max(0, leftPx),
            topPx + heightPx / 2 - 1,
            adjustPx + (leftPx < 0 ? leftPx : 0),
            2,
            canvasWidth,
            '#333',
          )
        }
      }
    }

    // second pass, draw wide insertion markers on top
    if (drawIndels) {
      for (let i = 0; i < mismatches.length; i += 1) {
        const mismatch = mismatches[i]
        const mstart = start + mismatch.start
        const mlen = mismatch.length
        const [leftPx] = bpSpanPx(mstart, mstart + mlen, region, bpPerPx)
        const len = +mismatch.base || mismatch.length
        const txt = `${len}`
        if (mismatch.type === 'insertion' && len >= 10) {
          if (bpPerPx > largeInsertionIndicatorScale) {
            fillRect(ctx, leftPx - 1, topPx, 2, heightPx, canvasWidth, 'purple')
          } else if (heightPx > charHeight) {
            const rwidth = measureText(txt)
            const padding = 5
            fillRect(
              ctx,
              leftPx - rwidth / 2 - padding,
              topPx,
              rwidth + 2 * padding,
              heightPx,
              canvasWidth,
              'purple',
            )
            ctx.fillStyle = 'white'
            ctx.fillText(txt, leftPx - rwidth / 2, topPx + heightPx)
          } else {
            const padding = 2
            fillRect(
              ctx,
              leftPx - padding,
              topPx,
              2 * padding,
              heightPx,
              canvasWidth,
              'purple',
            )
          }
        }
      }
    }
  }

  drawSoftClipping({
    ctx,
    feat,
    renderArgs,
    config,
    theme,
    canvasWidth,
  }: {
    ctx: CanvasRenderingContext2D
    feat: LayoutFeature
    renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
    config: AnyConfigurationModel
    theme: Theme
    canvasWidth: number
  }) {
    const { feature, topPx, heightPx } = feat
    const { regions, bpPerPx } = renderArgs
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
          const s = feature.get('start')
          const softClipStart =
            mismatch.start === 0 ? s - softClipLength : s + mismatch.start

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
            fillRect(
              ctx,
              softClipLeftPx,
              topPx,
              softClipWidthPx,
              heightPx,
              canvasWidth,
            )

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

  makeImageData({
    ctx,
    layoutRecords,
    canvasWidth,
    renderArgs,
  }: {
    ctx: CanvasRenderingContext2D
    canvasWidth: number
    layoutRecords: (LayoutFeature | null)[]
    renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
  }) {
    const {
      layout,
      config,
      showSoftClip,
      colorBy,
      theme: configTheme,
    } = renderArgs
    const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
    const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth')
    const largeInsertionIndicatorScale = readConfObject(
      config,
      'largeInsertionIndicatorScale',
    )
    const defaultColor = readConfObject(config, 'color') === '#f0f'

    const theme = createJBrowseTheme(configTheme)
    const colorForBase = getColorBaseMap(theme)
    const contrastForBase = getContrastBaseMap(theme)
    if (!layout) {
      throw new Error(`layout required`)
    }
    if (!layout.addRect) {
      throw new Error('invalid layout object')
    }
    ctx.font = 'bold 10px Courier New,monospace'

    const { charWidth, charHeight } = this.getCharWidthHeight(ctx)
    const drawSNPs = shouldDrawSNPs(colorBy?.type)
    const drawIndels = shouldDrawIndels(colorBy?.type)
    for (let i = 0; i < layoutRecords.length; i++) {
      const feat = layoutRecords[i]
      if (feat === null) {
        continue
      }

      this.drawAlignmentRect({
        ctx,
        feat,
        renderArgs,
        defaultColor,
        colorForBase,
        contrastForBase,
        charWidth,
        charHeight,
        canvasWidth,
      })
      this.drawMismatches({
        ctx,
        feat,
        renderArgs,
        mismatchAlpha,
        drawSNPs,
        drawIndels,
        largeInsertionIndicatorScale,
        minSubfeatureWidth,
        charWidth,
        charHeight,
        colorForBase,
        contrastForBase,
        canvasWidth,
      })
      if (showSoftClip) {
        this.drawSoftClipping({
          ctx,
          feat,
          renderArgs,
          config,
          theme,
          canvasWidth,
        })
      }
    }
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

    const featureMap =
      sortedBy?.type && region.start === sortedBy.pos
        ? sortFeature(features, sortedBy)
        : features

    const heightPx = readConfObject(config, 'height')
    const displayMode = readConfObject(config, 'displayMode')
    return iterMap(
      featureMap.values(),
      feature =>
        this.layoutFeature({
          feature,
          layout,
          bpPerPx,
          region,
          showSoftClip,
          heightPx,
          displayMode,
        }),
      featureMap.size,
    )
  }

  async fetchSequence(renderProps: RenderArgsDeserialized) {
    const { sessionId, regions, adapterConfig } = renderProps
    const { sequenceAdapter } = adapterConfig
    if (!sequenceAdapter) {
      return undefined
    }
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      sequenceAdapter,
    )
    const [region] = regions
    return fetchSequence(region, dataAdapter as BaseFeatureDataAdapter)
  }

  async render(renderProps: RenderArgsDeserialized) {
    const features = await this.getFeatures(renderProps)
    const layout = this.createLayoutInWorker(renderProps)
    const { regions, bpPerPx } = renderProps

    const layoutRecords = this.layoutFeats({
      ...renderProps,
      features,
      layout,
    })
    const [region] = regions

    // only need reference sequence if there are features and only for some
    // cases
    const regionSequence =
      features.size && shouldFetchReferenceSequence(renderProps.colorBy?.type)
        ? await this.fetchSequence(renderProps)
        : undefined
    const { end, start } = region

    const width = (end - start) / bpPerPx
    const height = Math.max(layout.getTotalHeight(), 1)
    const res = await renderToAbstractCanvas(
      width,
      height,
      renderProps,
      (ctx: CanvasRenderingContext2D) =>
        this.makeImageData({
          ctx,
          layoutRecords,
          canvasWidth: width,
          renderArgs: {
            ...renderProps,
            layout,
            features,
            regionSequence,
          },
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
      features: new Map(),
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

export type {
  RenderArgs,
  RenderArgsSerialized,
  RenderResults,
  ResultsSerialized,
  ResultsDeserialized,
}
