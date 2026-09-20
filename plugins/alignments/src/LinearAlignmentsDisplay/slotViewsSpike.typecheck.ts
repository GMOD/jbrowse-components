import { configSlotViews } from './configSlotViews.ts'
import { slotViews } from './slotViewsSpike.ts'

import type { ConfigSlotSelf } from './configSlotViews.ts'

declare const self: ConfigSlotSelf

const derived = slotViews(self, [
  'linkedReads',
  'showBezierConnections',
  'showCoverage',
  'showPileup',
  'coverageHeight',
  'coverageSnpMinFrequency',
  'showMismatches',
  'showInterbaseIndicators',
  'flipStrandLongReadChains',
  'colorSupplementaryChains',
  'drawInter',
  'drawProperPairArcs',
  'minInterchromSupport',
  'drawLongRange',
  'arcColorByType',
  'readConnections',
  'readConnectionsDown',
  'showSashimiArcs',
  'sashimiArcsMode',
  'minSashimiScore',
  'sashimiArcsHeight',
  'readConnectionsHeight',
  'showSoftClipping',
  'maxHeight',
  'showSashimiLabels',
  'hideNonCanonicalJunctions',
  'mismatchAlpha',
  'largeFeaturesFirst',
  'splicedReadsFirst',
  'readConnectionsLineWidth',
])
const hand = configSlotViews(self)

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

type Verdict = {
  [K in keyof typeof derived]: Equal<(typeof derived)[K], (typeof hand)[K]>
}

export const everyDerivedTypeMatchesTheHandAnnotation: {
  [K in keyof typeof derived]: true
} = {} as Verdict
