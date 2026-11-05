import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'

import {
  getGridlineTicks,
  getScalebarLabels,
  regionsOrientation,
} from './util.ts'

import type { BlockLayoutInput } from '@jbrowse/core/util/calculateStaticBlocks'
import type { Region } from '@jbrowse/core/util/types'

/**
 * What the view's getters give its SVG chrome (`LgvSvgChromeView`), computed
 * from the layout they read: the blocks, the ruler's ticks and labels in the
 * static blocks' frame, and the assemblies named in the header.
 */
export function lgvChromeOf(
  layout: BlockLayoutInput & { displayedRegions: Region[] },
) {
  const { displayedRegions, bpPerPx, offsetPx } = layout
  const staticBlocks = calculateStaticBlocks(layout)
  const dynamicBlocks = calculateDynamicBlocks(layout)
  const displayedRegionsOrientation = regionsOrientation(displayedRegions)
  const ruler = {
    blocks: staticBlocks.blocks,
    firstBlockOffset: staticBlocks.offsetPx,
    bpPerPx,
  }
  return {
    assemblyNames: [...new Set(displayedRegions.map(r => r.assemblyName))],
    hasVisibleContent: dynamicBlocks.contentBlocks.length > 0,
    staticBlocks,
    dynamicBlocks,
    staticBlocksTranslateX: staticBlocks.offsetPx - offsetPx,
    displayedRegionsOrientation,
    gridlineTicks: getGridlineTicks(ruler),
    scalebarLabels: getScalebarLabels({
      ...ruler,
      orientation: displayedRegionsOrientation,
    }),
  }
}
