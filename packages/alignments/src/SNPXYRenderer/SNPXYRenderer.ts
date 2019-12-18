import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import Color from 'color'
import SNPBaseRenderer from '../SNPBaseRenderer'
import NestedFrequencyTable from '../NestedFrequencyTable'
import { Mismatch } from '../SNPAdapter/SNPSlightlyLazyFeature'
import { getOrigin, getScale } from '../util'

interface SNPXYRendererProps{
  features: Map<string, Feature>
  layout: any // eslint-disable-line @typescript-eslint/no-explicit-any
  config: any // eslint-disable-line @typescript-eslint/no-explicit-any
  region: IRegion
  bpPerPx: number
  height: number
  width: number
  horizontallyFlipped: boolean
  highResolutionScaling: number
  blockKey: string
  dataAdapter: any
  notReady: boolean
  originalRegion: IRegion
  scaleOpts: any
  sessionId: string
  signal: any
  trackModel: any
}

export default class SNPXYRenderer extends SNPBaseRenderer {
  // Uncomment Below if extra time, make code cleaner by not redeclaring the consts
  // scale(props: SNPXYRendererProps){
  //   return 1 / props.bpPerPx
  // }

  // widthBp(leftBase: number, rightBase: number){
  //   return leftBase - rightBase
  // }

  // widthPx(widthBp: number, scale: number){
  //   return widthBp * scale
  // }

  // binWidth(bpPerPx: number){
  //   return Math.ceil(bpPerPx)
  // }

  // binMax(leftBase: number, rightBase: number, binWidth: number){
  //   return Math.ceil((rightBase - leftBase) / binWidth)
  // }

  generateCoverageBins(props: SNPXYRendererProps){
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props

    const leftBase = region.start
    const rightBase = region.end
    const scale = 1 / bpPerPx
    const widthBp = rightBase - leftBase
    const widthPx = widthBp * scale
    const binWidth = Math.ceil(bpPerPx)
    const binMax = Math.ceil((rightBase - leftBase) / binWidth)

    // maybe unused below
    // function binNumber(bp: number) {
    //   return Math.floor((bp - leftBase) / binWidth)
    // }

    const coverageBins = new Array(binMax).fill(0)

    for (let i = 0; i < binMax; i++) {
      coverageBins[i] = new NestedFrequencyTable()
      if (binWidth === 1) coverageBins[i].snpsCounted = true
    }
    // coverageBins.forEach(function iterate(item, index) {
    //   coverageBins[index] = new NestedFrequencyTable()
    //   try below if nested doest work
    //   const info = { mutationCount: 0, currentBp: '', snpsCounted: false }
    //   coverageBins[index].push(info)
    //   if (binWidth === 1) coverageBins[index].snpsCounted = true
    // })

    const forEachBin = function forEachBin(start: number, end: number, callback: any) {
      let s = (start - leftBase) / binWidth
      let e = (end - 1 - leftBase) / binWidth
      let sb = Math.floor(s)
      let eb = Math.floor(e)

      if (sb >= binMax || eb < 0) return // does not overlap this block

      // enforce 0 <= bin < binMax
      if (sb < 0) {
        s = 0
        sb = 0
      }
      if (eb >= binMax) {
        eb = binMax - 1
        e = binMax
      }
      // now iterate
      if (sb === eb) {
        // if in the same bin, just one call
        callback(sb, e - s)
      } else {
        // if in different bins, two or more calls
        callback(sb, sb + 1 - s)
        for (let i = sb + 1; i < eb; i++) callback(i, 1)
        callback(eb, e - eb)
      }
    }

    function getStrand(feature: Feature) {
      const result = feature.get('strand');
      let strand = ''
      switch(result){
        case -1:
          strand = '-'
          break;
        case 1:
          strand = '+'
          break;
        default:
          strand = 'unstranded'
          break;
      }
      // const strand =
      //   { '-1': '-', '1': '+' }[`${features.get('strand')}`] || 'unstranded'
      // if (!this.filter(features)) return
      return strand
    }

    // move to stats potentially!!!!
    for(const feature of features.values()){ 
      const strand = getStrand(feature)
      // increment start and end partial-overlap bins by proportion of overlap
      forEachBin(region.start, region.end, function(bin: number, overlap: number) {
        coverageBins[bin].getNested('reference').increment(strand, overlap)
      })

      // Calculate SNP coverage
      if (binWidth === 1) {
        const mismatches: Mismatch[] =
          bpPerPx < 10
            ? feature.get('mismatches')
            : feature.get('skips_and_dels')
        // loops through mismatches and updates coverage variables accordingly.
        for (let i = 0; i < mismatches.length; i++) {
          const mismatch = mismatches[i]
          forEachBin(
            feature.get('start') + mismatch.start,
            feature.get('start') + mismatch.start + mismatch.length,
            function calcSNPCoverage(binNum: number, overlap: number) {
              // Note: we decrement 'reference' so that total of the score is the total coverage
              const bin = coverageBins[binNum]
              bin.getNested('reference').decrement(strand, overlap)
              let { base } = mismatch
              if (mismatch.type === 'insertion') base = `ins ${base}`
              else if (mismatch.type === 'skip') base = 'skip'
              bin.getNested(base).increment(strand, overlap)
            },
          )
        }
      }
    }
    //console.log(coverageBins)
    return coverageBins
  }

  draw(ctx: CanvasRenderingContext2D, props: SNPXYRendererProps, coverageBins: Array<NestedFrequencyTable>) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props
    // const pivotValue = readConfObject(config, 'bicolorPivotValue')
    // const negColor = readConfObject(config, 'negColor')
    // const posColor = readConfObject(config, 'posColor')
    // const filled = readConfObject(config, 'filled')
    // const clipColor = readConfObject(config, 'clipColor')
    // const highlightColor = readConfObject(config, 'highlightColor')
    // const summaryScoreMode = readConfObject(config, 'summaryScoreMode')
    // const scale = getScale({ ...scaleOpts, range: [0, height] })
    // const originY = getOrigin(scaleOpts.scaleType)
    // const [niceMin, niceMax] = scale.domain()
    // const toY = rawscore => height - scale(rawscore)
    // const toHeight = rawscore => toY(originY) - toY(rawscore)
    // let colorCallback
    // if (readConfObject(config, 'color') === '#f0f') {
    //   colorCallback = feature =>
    //     feature.get('score') < pivotValue ? negColor : posColor
    // } else {
    //   colorCallback = feature => readConfObject(config, 'color', [feature])
    // }
    // console.log('Props in SNPXYRend', props)
    // console.log('Feature in SNPXYRend', features)

    //const coverageBins = this.generateCoverageBins(props)

    //start with leftbase, for each bin, draw rect ctx.fillREct with binWidth width, height depending on total coverage (maybe coverageBin[bin].total)
    // go to next bin, start next rect at leftbase + binWidth * 1, then * 2 etc

    const leftBase = region.start
    const rightBase = region.end
    const scale = 1 / bpPerPx
    const widthBp = rightBase - leftBase
    const widthPx = widthBp * scale
    const binWidth = Math.ceil(bpPerPx)
    const binMax = Math.ceil((rightBase - leftBase) / binWidth)

    ctx.fillStyle = 'darkgray'

    coverageBins.forEach( function(currentBin: NestedFrequencyTable, index: number){
      //console.log(currentBin, index)
      console.log(leftBase + (binWidth * index), rightBase, binWidth, currentBin.total())
      ctx.fillRect(leftBase + (binWidth * index), rightBase, binWidth, currentBin.total())
    })
    // for (const feature of features.values()) {
    //   console.log(feature)
    //   ctx.fillRect(0, 100, 100, 100)
    // }

    //   const [leftPx, rightPx] = featureSpanPx(
    //     feature,
    //     region,
    //     bpPerPx,
    //     horizontallyFlipped,
    //   )
    //   let score = feature.get('score')
    //   const maxr = feature.get('maxScore')
    //   const minr = feature.get('minScore')
    //   const lowClipping = score < niceMin
    //   const highClipping = score > niceMax
    //   const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
    //   const c = colorCallback(feature)
    //   if (summaryScoreMode === 'max') {
    //     score = maxr === undefined ? score : maxr
    //     ctx.fillStyle = c
    //     ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    //   } else if (summaryScoreMode === 'min') {
    //     score = minr === undefined ? score : minr
    //     ctx.fillStyle = c
    //     ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    //   } else if (summaryScoreMode === 'whiskers') {
    //     // max
    //     if (maxr !== undefined) {
    //       ctx.fillStyle = Color(c)
    //         .lighten(0.6)
    //         .toString()
    //       ctx.fillRect(leftPx, toY(maxr), w, filled ? toHeight(maxr) : 1)
    //     }
    //     // normal
    //     ctx.fillStyle = c
    //     ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    //     // min
    //     if (minr !== undefined) {
    //       ctx.fillStyle = Color(c)
    //         .darken(0.6)
    //         .toString()
    //       ctx.fillRect(leftPx, toY(minr), w, filled ? toHeight(minr) : 1)
    //     }
    //   } else {
    //     ctx.fillStyle = c
    //     ctx.fillRect(leftPx, toY(score), w, filled ? toHeight(score) : 1)
    //   }
    //   if (highClipping) {
    //     ctx.fillStyle = clipColor
    //     ctx.fillRect(leftPx, 0, w, 4)
    //   } else if (lowClipping && scaleOpts.scaleType !== 'log') {
    //     ctx.fillStyle = clipColor
    //     ctx.fillRect(leftPx, height - 4, w, height)
    //   }
    //   if (feature.get('highlighted')) {
    //     ctx.fillStyle = highlightColor
    //     ctx.fillRect(leftPx, 0, w, height)
    //   }
    // }
    // }
  }
}
