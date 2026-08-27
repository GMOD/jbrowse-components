export {
  bpToCumBp,
  buildBpRegionIndex,
  cumBpAtGenomicCoord,
  cumBpInEntry,
  findRegionEntry,
} from './bpRegionIndex.ts'
export type {
  BpIndexViewSnap,
  BpRegionIndex,
  RegionIndexEntry,
} from './bpRegionIndex.ts'
export {
  allVsAllTypes,
  mcscanBlocksTypes,
  mcscanTypes,
  pairwiseTypes,
  syntenyTypes,
} from './syntenyTypes.ts'
export { clampBlockToRegions } from './clampBlockToRegions.ts'
export type { ClampedBlock } from './clampBlockToRegions.ts'
export { makeStringDict } from './stringDict.ts'
export type { StringDict } from './stringDict.ts'
export {
  PAN_BUFFER_PX,
  syntenyFetchRegions,
  syntenyPanBufferPx,
} from './syntenyFetchWindow.ts'
export { fetchWindowSignature, regionSignature } from './regionSignature.ts'
export { bucketBpPerPx } from './bpPerPxBucket.ts'
export {
  getCoarseBpPerPxThreshold,
  lodMenuItems,
  resolveLodTier,
  trackHasLodTiers,
} from './lodTier.ts'
export type { ComparativeTrackModel, LodMode, LodTier } from './lodTier.ts'
export { extractAlignmentData } from './extractAlignmentData.ts'
// Promoted to core (a pure signature compare, no synteny deps); re-exported here
// so the comparative-view consumers keep importing it from @jbrowse/synteny-core.
export { isDataCurrent } from '@jbrowse/core/util'
// Promoted to core: a third surface owner needed it (the breakpoint split
// view's overlay), and its model is eager, so reaching it through this barrel
// would have dragged the chunk behind these components onto every page.
export { installClearHoverOnSurfaceMove } from '@jbrowse/core/util/installClearHoverOnSurfaceMove'
export {
  detectAssembliesSwapped,
  detectDisplayAssembliesSwapped,
  installAssemblySwapCheck,
} from './detectSwappedAssemblies.ts'
// Promoted to core (depends only on core); re-exported here so the
// comparative-view consumers keep importing it from @jbrowse/synteny-core.
export { type ActiveFetch, createStopTokenRotation } from '@jbrowse/core/util'
export {
  getAdapterToCanonicalRefNameMap,
  renameRegionsForAdapter,
} from './renameRegionsForAdapter.ts'
export { renameDictLane } from './renameDictLane.ts'
export { getCanonicalRefNameFn } from './getCanonicalRefNameFn.ts'
export { installComparativeFetchAutorun } from './installComparativeFetchAutorun.ts'
export { releaseTemporaryAssemblies } from './releaseTemporaryAssemblies.ts'
export type { ComparativeFetchContext } from './installComparativeFetchAutorun.ts'
// Types only. `executeDiagonalize` itself is deliberately NOT exported here:
// `runDiagonalize` reaches it through a dynamic import, and a static export
// beside that is how the deferral gets silently undone — a bundler that sees the
// module imported both ways puts it in the main chunk, which is the same trap
// packages/tree-sidebar/CLAUDE.md prices at 608KB vs 539KB. Call runDiagonalize.
export type {
  DiagonalizeAdapterSpec,
  DiagonalizeArgs,
  DiagonalizeExecuteArgs,
} from './executeDiagonalize.ts'
export { runDiagonalize } from './runDiagonalize.ts'
export { prepareDiagonalizeAdapter } from './prepareDiagonalizeAdapter.ts'
export {
  LEGEND_CHIP_ALPHA_FLOOR,
  attributeColorBy,
  blendOverWhite,
  coerceColorBy,
  colorByAttributeName,
  legendChipColor,
  colorSchemes,
  defaultCigarColors,
  getQueryColor,
  hashString,
  strandCigarColors,
} from './colorUtils.ts'
export type { ColorScheme, SyntenyColorBy } from './colorUtils.ts'
export { assignTrackColors, syntenyTrackPalette } from './trackColors.ts'
export { TrackColorsMixin } from './TrackColorsMixin.ts'
export type { ColorableTrack, PalettableTrack } from './trackColors.ts'
export { colorByMenuItems, colorByMenuTargetFor } from './colorByMenuItems.tsx'
export type {
  ColorByMenuTarget,
  ColorByMenuTrack,
  TrackColorsModel,
} from './colorByMenuItems.tsx'
// the palette button itself, not just the menu inside it — the two headers had a
// copy each and only one of them said which mode it was in
export { default as ColorBySelector } from './ColorBySelector.tsx'
export { default as ComparativeTooltip } from './ComparativeTooltip.tsx'
export {
  PRESET_ATTRIBUTES,
  createAttributeChannels,
  declaredAttributes,
  readAttribute,
  writeAttribute,
} from './attributeChannels.ts'
export type { AttributeChannel } from './attributeChannels.ts'
export {
  attributeTooltipLines,
  featureAttributes,
} from './attributeTooltipLines.ts'
export { comparativeTooltipLines } from './comparativeTooltipLines.ts'
export type { ComparativeTooltipSide } from './comparativeTooltipLines.ts'
export {
  ATTRIBUTE_PREFIX,
  continuousRampConfig,
  dnDsRatio,
  rampNorm,
  resolveContinuousMode,
} from './colorRamps.ts'
export type { AttributeRange, ContinuousMode, Rgb } from './colorRamps.ts'
export {
  MISSING_VALUE_COLOR,
  createComparativeColorFunction,
  makeContinuousColorFunction,
  makeNameColorFunction,
  nameColorCss,
  paletteColorAt,
} from './colorFunctions.ts'
export type { ColorFunctionInputs } from './colorFunctions.ts'
export { ColorByLegend } from './ColorByLegend.tsx'
export { SVGColorByLegend } from './SVGColorByLegend.tsx'
export {
  CIGAR_OP_D,
  CIGAR_OP_I,
  CIGAR_OP_N,
  NO_CIGAR_OPS,
  colorByFallbackNote,
  colorByShortLabel,
  getColorBySwatch,
  trackLegendChips,
} from './colorLegend.ts'
export type {
  CigarOpMask,
  ColorBySwatchSpec,
  ColorChip,
  GradientStop,
} from './colorLegend.ts'
export type { SyntenyViewSharedInit } from './SyntenyViewInit.ts'
export { launchSyntenyView } from './launchSyntenyView.ts'
export { default as HelpTooltip } from './HelpTooltip.tsx'
export { default as DiagonalizeLoadingScreen } from './DiagonalizeLoadingScreen.tsx'
export { default as DiagonalizeDialog } from './DiagonalizeDialog.tsx'
export type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from './diagonalizeTypes.ts'
export { withDiagonalizeProgress } from './withDiagonalizeProgress.ts'
export { DiagonalizeProgressMixin } from './DiagonalizeProgressMixin.ts'
export {
  SyntenyFetchStateMixin,
  swappedAssembliesWarning,
} from './SyntenyFetchStateMixin.ts'
export {
  comparativeDisplayPhase,
  comparativeSurfacePhase,
  comparativeSurfaceSettled,
  displaysSettled,
} from './comparativeReadiness.ts'
export type {
  ComparativeDisplayFetchState,
  ComparativeSurface,
} from './comparativeReadiness.ts'
export { comparativeFetchFlags } from './comparativeFetchFlags.ts'
export type {
  ComparativeFetchFlags,
  ComparativeFetchInputs,
} from './comparativeFetchFlags.ts'
export type { ComparativeWarning } from './SyntenyFetchStateMixin.ts'
// Warning rows named by the track that raised them, and the one report both
// views open over them — shared so a report cannot say different things
// depending on which comparative view you are in.
export { collectTrackWarnings } from './trackWarnings.ts'
export type { TrackWarning, WarningSource } from './trackWarnings.ts'
export { default as TrackWarningsDialog } from './TrackWarningsDialog.tsx'
// The per-display fetch status both comparative views render, so a first load
// looks the same in each — see the component for the drift it ends.
export { default as ComparativeFetchStatus } from './ComparativeFetchStatus.tsx'
export type { ComparativeStatusModel } from './ComparativeFetchStatus.tsx'
export { MAX_MIN_LENGTH_BP, MIN_LENGTH_HELP } from './minLengthHelp.ts'
export { COLOR_MODES } from './colorModes.ts'
export { SETTINGS_SURFACE_LABELS } from './settingsSurfaces.ts'
export { defaultSyntenyFileFormats } from './defaultSyntenyFileFormats.tsx'
export {
  connectedEndpoints,
  getConnectedAssemblies,
  getSyntenyTracks,
  isSyntenyTrack,
  pickSyntenyTrackId,
  sameAssemblySet,
} from './getSyntenyTracks.ts'
export {
  dotplotAxesFromRows,
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from './syntenyTrackRows.ts'
export { default as ChromosomeFilter } from './ChromosomeFilter.tsx'
export { useChromosomeFilters } from './useChromosomeFilters.ts'
export type { ChromosomeFilters } from './useChromosomeFilters.ts'
export { default as ImportFormModeToggle } from './ImportFormModeToggle.tsx'
export type { ImportFormMode } from './ImportFormModeToggle.tsx'
export { default as ImportFormModes } from './ImportFormModes.tsx'
export { default as QuickStartPanel } from './QuickStartPanel.tsx'
export {
  applyQuickStartSelections,
  useQuickStartState,
} from './useQuickStartState.ts'
export { default as PreConfiguredSyntenyTrackSelect } from './PreConfiguredSyntenyTrackSelect.tsx'
export { planSyntenyChain } from './planSyntenyChain.ts'
export {
  resolveRowTrackAction,
  resolveSyntenyTrackActions,
} from './resolveRowTrackAction.ts'
export type { RowTrackAction } from './resolveRowTrackAction.ts'
export {
  blockedByUnfinishedUpload,
  syntenyPairStatuses,
} from './syntenyPairStatuses.ts'
export type { PairStatus } from './syntenyPairStatuses.ts'
// Promoted to core (any feature listing tracks wants it, not just synteny);
// re-exported here so the synteny/comparative consumers keep one import.
export { allSessionTracks } from '@jbrowse/core/util/tracks'
export { syntenyPairs } from './syntenyPairs.ts'
export {
  remapImportFormSelections,
  remapSelectionsToPairs,
} from './remapSelectionsToPairs.ts'
export { applySyntenyTrackSelections } from './applySyntenyTrackSelections.ts'
export { default as ImportFormSyntenyTrackPanel } from './ImportFormSyntenyTrackPanel.tsx'
export { default as NoSyntenyTrackMessage } from './NoSyntenyTrackMessage.tsx'
export { useImportFormSyntenyChoices } from './useImportFormSyntenyChoices.ts'
export type { ImportFormSyntenyChoices } from './useImportFormSyntenyChoices.ts'
export { default as ImportFormSyntenyChoiceRadioGroup } from './ImportFormSyntenyChoiceRadioGroup.tsx'
export { default as ImportFormOpenCustomTrack } from './ImportFormOpenCustomTrack.tsx'
export { default as ImportSyntenyOpenCustomTrack } from './ImportSyntenyOpenCustomTrack.tsx'
export { default as AnchorsSelector } from './AnchorsSelector.tsx'
export { default as PifGzSelector } from './PifGzSelector.tsx'
export { default as StandardFormatSelector } from './StandardFormatSelector.tsx'
export { default as SwapAssemblies } from './SwapAssemblies.tsx'
export type {
  ImportFormSyntenyTrack,
  SelectorProps,
  SyntenyFileFormatOption,
} from './SelectorTypes.ts'
