import Plugin from '@jbrowse/core/Plugin'

import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail/index.ts'
import AlignmentsTrackF from './AlignmentsTrack/index.ts'
import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes/index.ts'
import HtsgetBamAdapterF from './HtsgetBamAdapter/index.ts'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay/index.ts'
import PileupDataRPCMethodsF from './RenderAlignmentDataRPC/index.ts'
import SamAdapterF from './SamAdapter/index.ts'
import ConsensusSequenceF from './consensus/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    for (const f of [
      CramAdapterF,
      BamAdapterF,
      SamAdapterF,
      AlignmentsTrackF,
      HtsgetBamAdapterF,
      PileupDataRPCMethodsF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
      GuessAlignmentsTypesF,
      ConsensusSequenceF,
    ]) {
      f(pluginManager)
    }
  }
}

export {
  linearAlignmentsDisplayConfigSchemaFactory,
  linearAlignmentsDisplayStateModelFactory,
} from './LinearAlignmentsDisplay/index.ts'
export type { LinearAlignmentsDisplayModel } from './LinearAlignmentsDisplay/model.ts'
// The fixed read-height presets, exported so a caller that writes `featureHeight`
// without going through the menu can use the same three numbers. @jbrowse/img
// pins its own copy against this one's literal types, so the two cannot drift.
export { COMPACTNESS_PRESETS } from './LinearAlignmentsDisplay/menus/compactnessPresets.ts'
export {
  collapseGroupRowsItems,
  copyFeatureInfo,
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItems,
  getHitMenuItems,
  getMaxHeightMenuItem,
  getSortByMenuItem,
  groupByRadioMenuItem,
  withContextMenuFeature,
} from './LinearAlignmentsDisplay/menus/index.ts'
export type { CollapseGroupRowsModel } from './LinearAlignmentsDisplay/menus/index.ts'
export { queueReadVsRefDialog } from './ReadVsRefDialog/index.ts'
export type { ReadVsRefLaunchArgs } from './ReadVsRefDialog/index.ts'
export {
  isRegisteredColorScheme,
  pickColorOptions,
} from './shared/colorSchemes.ts'
export { pickGroupByOptions } from './shared/groupFeatures.ts'
export type { GroupByType } from './shared/types.ts'

// Types that appear in the inferred shape of the exported display model. They
// have to be reachable from this entry or tsc names them by source path in
// consumers' .d.ts — see scripts/check-declaration-leaks.ts.
export type { ArcsUploadData } from './features/arcs/types.ts'
export type {
  ArcsByGroupResult,
  CrossRegionArc,
} from './features/arcs/compute.ts'
export type { CrossRegionArcShape } from './features/arcs/crossRegionOverlay.ts'
export type {
  DerivativeCandidate,
  DerivativeSegment,
} from './features/derivativePaths/computePaths.ts'
export type { IndicatorHitResult } from './features/indicator/types.ts'
export type { LinkedPair } from './features/linkedReads/compute.ts'
export type { BezierArcScope } from './features/linkedReads/computeOverlay.ts'
export type { ModificationHitResult } from './features/modification/hitTest.ts'
export type { SashimiArc } from './features/sashimi/computeOverlay.ts'
export type { ReadColorCategory } from './LinearAlignmentsDisplay/colorUtils.ts'
export type { ArcHighlight } from './LinearAlignmentsDisplay/components/arcHitTest.ts'
export type { HighlightBox } from './LinearAlignmentsDisplay/components/computeHighlightBoxes.ts'
export type { VisibleLabel } from './LinearAlignmentsDisplay/components/computeVisibleLabels.ts'
export type { ContextMenuHit } from './LinearAlignmentsDisplay/components/hitTestPipeline.ts'
export type { SashimiArcSection } from './LinearAlignmentsDisplay/components/sashimiArcs.ts'
export type { ScrollModel } from './LinearAlignmentsDisplay/components/sectionScreen.ts'
export type { TooltipPayload } from './LinearAlignmentsDisplay/components/tooltipUtils.ts'
export type {
  LinkedReadsMode,
  ReadConnectionsMode,
  SashimiArcsMode,
} from './LinearAlignmentsDisplay/constants.ts'
export type { GroupId } from './LinearAlignmentsDisplay/groupedDataMaps.ts'
export type { LaidOutByGroup } from './LinearAlignmentsDisplay/groupLayout.ts'
export type {
  AlignmentsRenderingBackend,
  SectionRender,
} from './LinearAlignmentsDisplay/renderers/rendererTypes.ts'
export type { SectionsLayout } from './LinearAlignmentsDisplay/sectionLayout.ts'
export type { ColorPalette } from './shaders/colors.ts'
export type {
  GroupedAlignmentsResult,
  PileupDataResult,
} from './RenderAlignmentDataRPC/types.ts'
export type { CigarHitResult, ResolvedBlock } from './shared/hitTestTypes.ts'
export type {
  ArcColorByType,
  ColorBy,
  FilterBy,
  GroupBy,
  SortedBy,
} from './shared/types.ts'
