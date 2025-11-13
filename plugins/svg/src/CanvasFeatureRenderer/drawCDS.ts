import { readConfObject } from '@jbrowse/core/configuration'
import { colord } from '@jbrowse/core/util/colord'
import { darken, lighten } from '@mui/material'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'

import { drawBox } from './drawBox'
import { getBoxColor } from './util'

import type { DrawFeatureArgs, DrawingResult } from './types'

interface AggregatedAminoAcid {
  aminoAcid: string
  startIndex: number
  endIndex: number
  length: number
  proteinIndex: number
}

/**
 * Aggregates consecutive genomic positions that map to the same amino acid
 */
function aggregateAminos(
  protein: string,
  g2p: Record<string, number>,
  featureStart: number,
  featureEnd: number,
  strand: number,
): AggregatedAminoAcid[] {
  const aggregated: AggregatedAminoAcid[] = []
  const len = featureEnd - featureStart

  let currentElt: number | undefined = undefined
  let currentAminoAcid: string | null = null
  let startIndex = 0
  let idx = 0

  for (let i = 0; i < len; i++) {
    const pos = strand === -1 ? featureEnd - i : featureStart + i
    const elt = g2p[pos]!
    const aminoAcid = protein[elt] ?? '&'

    if (currentElt === undefined) {
      currentElt = elt
      currentAminoAcid = aminoAcid
      startIndex = idx
    } else if (currentElt !== elt) {
      aggregated.push({
        aminoAcid: currentAminoAcid!,
        startIndex,
        endIndex: idx - 1,
        length: idx - startIndex,
        proteinIndex: currentElt,
      })
      currentElt = elt
      currentAminoAcid = aminoAcid
      startIndex = idx
    }

    idx++
  }

  if (currentAminoAcid !== null) {
    aggregated.push({
      aminoAcid: currentAminoAcid,
      startIndex,
      endIndex: idx - 1,
      length: idx - startIndex,
      proteinIndex: currentElt!,
    })
  }

  return aggregated
}

/**
 * Draw a CDS feature with optional peptide rendering on the canvas
 */
export function drawCDS(args: DrawFeatureArgs): DrawingResult {
  const {
    ctx,
    feature,
    featureLayout,
    region,
    bpPerPx,
    config,
    theme,
    reversed,
    peptideDataMap,
  } = args
  const { start, end } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand') as number
  const width = featureLayout.width
  const left = featureLayout.x
  const top = featureLayout.y
  const height = featureLayout.height

  const coords: number[] = []
  const items: DrawingResult['items'] = []

  if (left + width < 0) {
    return { coords, items }
  }

  const { colorByCDS: colorByCDSFromArgs } = args
  const zoomedInEnough = 1 / bpPerPx >= 10

  // Get peptide data for the parent feature (transcript)
  const parent = feature.parent() ?? feature
  const peptideData = peptideDataMap?.get(parent.id())
  const doRender =
    zoomedInEnough && colorByCDSFromArgs && !!peptideData?.protein

  if (colorByCDSFromArgs && zoomedInEnough) {
    console.log(
      '[drawCDS] feature:',
      feature.id(),
      'parent:',
      parent.id(),
      'has peptideData:',
      !!peptideData,
      'has protein:',
      !!peptideData?.protein,
      'doRender:',
      doRender,
    )
  }

  // Draw the base rectangle
  const baseColor = getBoxColor({
    feature,
    config,
    colorByCDS: !!colorByCDSFromArgs,
    theme,
  })

  // If we have peptide data and should render it
  if (doRender && peptideData?.protein) {
    const protein = peptideData.protein

    if (protein) {
      try {
        // @ts-expect-error - g2p_mapper types
        const g2p = genomeToTranscriptSeqMapping(parent.toJSON()).g2p

        if (g2p) {
          const aggregatedAminoAcids = aggregateAminos(
            protein,
            g2p,
            featureStart,
            featureEnd,
            strand,
          )

          const flipper = reversed ? -1 : 1
          const rightPos = left + width

          // Draw each amino acid
          for (const [
            index,
            aggregatedAminoAcid,
          ] of aggregatedAminoAcids.entries()) {
            const aa = aggregatedAminoAcid
            const centerIndex = Math.floor((aa.startIndex + aa.endIndex) / 2)
            const isNonTriplet = aa.length % 3 !== 0 || aa.aminoAcid === '&'

            const isAlternate = index % 2 === 1
            const bgColor = isAlternate
              ? darken(colord(baseColor).toHex(), 0.1)
              : lighten(colord(baseColor).toHex(), 0.2)

            if (strand * flipper === -1) {
              const startX = rightPos - (1 / bpPerPx) * aa.startIndex
              const endX = rightPos - (1 / bpPerPx) * (aa.endIndex + 1)
              const x = (startX + endX) / 2
              const rectWidth = startX - endX

              ctx.fillStyle = bgColor
              ctx.fillRect(endX, top, rectWidth, height)

              // Draw amino acid text
              if (height >= 8) {
                ctx.fillStyle = isNonTriplet ? 'red' : 'black'
                ctx.font = `${height}px sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                const text =
                  isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
                    ? aa.aminoAcid
                    : `${aa.aminoAcid}${aa.proteinIndex + 1}`
                ctx.fillText(text, x, top)
              }
            } else {
              const x = left + (1 / bpPerPx) * centerIndex + 1 / bpPerPx / 2
              const startX = left + (1 / bpPerPx) * aa.startIndex
              const endX = left + (1 / bpPerPx) * (aa.endIndex + 1)
              const rectWidth = endX - startX

              ctx.fillStyle = bgColor
              ctx.fillRect(startX, top, rectWidth, height)

              // Draw amino acid text
              if (height >= 8) {
                ctx.fillStyle = isNonTriplet ? 'red' : 'black'
                ctx.font = `${height}px sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                const text =
                  isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
                    ? aa.aminoAcid
                    : `${aa.aminoAcid}${aa.proteinIndex + 1}`
                ctx.fillText(text, x, top)
              }
            }
          }

          // Add to spatial index
          const leftWithinBlock = Math.max(left, 0)
          const widthWithinBlock = Math.max(
            2,
            Math.min(width, screenWidth - leftWithinBlock),
          )
          coords.push(
            leftWithinBlock,
            top,
            leftWithinBlock + widthWithinBlock,
            top + height,
          )
          items.push({
            featureId: feature.id(),
            type: 'cds',
            startBp: featureStart,
            endBp: featureEnd,
            topPx: top,
            bottomPx: top + height,
          })

          return { coords, items }
        }
      } catch (error) {
        console.warn('Failed to render peptides:', error)
        // Fall through to draw as regular box
      }
    }
  }

  // Fall back to regular box drawing if peptide rendering is not available or failed
  return drawBox(args)
}
