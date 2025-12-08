import { drawArrow } from './drawArrow'
import { drawSegments } from './drawSegments'
import { isOffScreen } from './util'

import type { DrawFeatureArgs } from './types'

const repeatColorMap: Record<string, string> = {
  CACTA_TIR_transposon: '#e6194b',
  centromeric_repeat: '#3cb44b',
  Copia_LTR_retrotransposon: '#118119',
  Gypsy_LTR_retrotransposon: '#4363d8',
  hAT_TIR_transposon: '#f58231',
  helitron: '#911eb4',
  knob: '#46f0f0',
  L1_LINE_retrotransposon: '#f032e6',
  LINE_element: '#bcf60c',
  long_terminal_repeat: '#fb0',
  low_complexity: '#008080',
  LTR_retrotransposon: '#e6beff',
  Mutator_TIR_transposon: '#9a6324',
  PIF_Harbinger_TIR_transposon: '#fffac8',
  rDNA_intergenic_spacer_element: '#800000',
  repeat_region: '#aaffc3',
  RTE_LINE_retrotransposon: '#808000',
  subtelomere: '#ffd8b1',
  target_site_duplication: '#000075',
  Tc1_Mariner_TIR_transposon: '#808080',
}

const shortenHeightFraction = 0.65

function drawRepeatBox(args: DrawFeatureArgs & { color: string }) {
  const { ctx, feature, featureLayout, canvasWidth, color } = args
  const left = featureLayout.x
  const width = featureLayout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const type = feature.get('type') as string
  const shorten = type.endsWith('_retrotransposon')

  let top = featureLayout.y
  let height = featureLayout.height

  if (shorten) {
    top += ((1 - shortenHeightFraction) / 2) * height
    height *= shortenHeightFraction
  }

  ctx.fillStyle = color
  ctx.fillRect(left, top, width, height)
}

export function drawRepeatRegion(args: DrawFeatureArgs) {
  const { featureLayout, canvasWidth } = args

  const left = featureLayout.x
  const width = featureLayout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  drawSegments(args)

  const sortedChildren = [...featureLayout.children].sort((a, b) => {
    const aType = a.feature.get('type') as string
    const bType = b.feature.get('type') as string
    if (aType.endsWith('_retrotransposon')) {
      return -1
    } else if (bType.endsWith('_retrotransposon')) {
      return 1
    } else {
      return 0
    }
  })

  for (const childLayout of sortedChildren) {
    const childFeature = childLayout.feature
    const type = childFeature.get('type') as string
    const color = repeatColorMap[type] || '#000'

    drawRepeatBox({
      ...args,
      feature: childFeature,
      featureLayout: childLayout,
      topLevel: false,
      color,
    })
  }

  drawArrow(args)
}
