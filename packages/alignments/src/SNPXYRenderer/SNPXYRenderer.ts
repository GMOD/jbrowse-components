import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import Color from 'color'
import SNPBaseRenderer from '../SNPBaseRenderer'
import NestedFrequencyTable from '../NestedFrequencyTable'
import { Mismatch } from '../SNPAdapter/SNPSlightlyLazyFeature'
import { getOrigin, getScale } from '../util'

interface SNPXYRendererProps {
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
  generateCoverageBins(props: SNPXYRendererProps) {
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
    const binWidth = bpPerPx <= 10 ? 1 : Math.ceil(bpPerPx)
    const binMax = Math.ceil((rightBase - leftBase) / binWidth)

    const coverageBins = new Array(binMax).fill(0)

    for (let i = 0; i < binMax; i++) {
      coverageBins[i] = new NestedFrequencyTable()
      if (binWidth === 1) coverageBins[i].snpsCounted = true
    }

    const forEachBin = function forEachBin(
      start: number,
      end: number,
      callback: any,
    ) {
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
      const result = feature.get('strand')
      let strand = ''
      switch (result) {
        case -1:
          strand = '-'
          break
        case 1:
          strand = '+'
          break
        default:
          strand = 'unstranded'
          break
      }
      return strand
    }

    for (const feature of features.values()) {
      const strand = getStrand(feature)
      // increment start and end partial-overlap bins by proportion of overlap
      forEachBin(feature.get('start'), feature.get('end'), function(
        bin: number,
        overlap: number,
      ) {
        coverageBins[bin].getNested('reference').increment(strand, overlap)
      })

      // Calculate SNP coverage
      if (binWidth === 1) {
        const mismatches: Mismatch[] =
          bpPerPx < 10
            ? feature.get('mismatches')
            : feature.get('skips_and_dels')

        // loops through mismatches and updates coverage variables accordingly.
        if (mismatches) {
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
    }
    return coverageBins
  }

  // use coverage bins generated above to draw
  draw(
    ctx: CanvasRenderingContext2D,
    props: SNPXYRendererProps,
    coverageBins: Array<NestedFrequencyTable>,
  ) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props

    const viewScale = getScale({ ...scaleOpts, range: [0, height] })
    const originY = getOrigin(scaleOpts.scaleType)
    const [niceMin, niceMax] = viewScale.domain()
    const toY = (rawscore: number) => height - viewScale(rawscore)
    const toHeight = (rawscore: number) => toY(originY) - toY(rawscore)

    const leftBase = region.start
    const rightBase = region.end
    const scale = 1 / bpPerPx
    const widthBp = rightBase - leftBase
    const widthPx = widthBp * scale
    const binWidth = bpPerPx <= 10 ? 1 : Math.ceil(bpPerPx)
    const binMax = Math.ceil((rightBase - leftBase) / binWidth)
    const insRegex = /^ins.[A-Za-z0-9]/
    const featureList = []
    // A: green, C: blue, g: orange, t: red, deletion: dark grey, total: light grey
    const colorForBase: { [key: string]: string } = {
      A: '#00bf00',
      C: '#4747ff',
      G: '#ffa500',
      T: '#f00',
      '*': 'darkgrey',
      total: 'lightgrey',
    }

    coverageBins.forEach(function(
      currentBin: NestedFrequencyTable,
      index: number,
    ) {
      const xposition = bpPerPx > 10 ? binWidth * index : scale * index
      const snpWidth = bpPerPx > 10 ? binWidth : scale
      const score = currentBin.total()

      // draw total
      ctx.fillStyle = colorForBase.total
      ctx.fillRect(xposition, toY(score), snpWidth, toHeight(score))

      // generate array with nestedtable's info, draw mismatches
      const infoArray = currentBin.generateInfoList()
      infoArray.forEach(function iterate(mismatch, mismatchindex) {
        if (mismatch.base === 'reference' || mismatch.base === 'total') return
        ctx.fillStyle = mismatch.base.match(insRegex)
          ? 'darkgrey'
          : colorForBase[mismatch.base]
        ctx.fillRect(
          xposition,
          toY(mismatch.score),
          scale,
          toHeight(mismatch.score),
        )
      })

      // list to be sent to props
      if (!featureList.map(e => e.position).includes(leftBase + index)) {
        featureList.push({
          info: infoArray,
          position: leftBase + index,
        })
      }
    })
    return featureList
  }
}
