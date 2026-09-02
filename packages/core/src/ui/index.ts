export {
  type JBrowseTheme,
  type SerializableThemeArgs,
  type ThemeMap,
  colorFwdStrand,
  colorInterchrom,
  colorLongInsert,
  colorLongreadInv,
  colorNeutralRead,
  colorPairLL,
  colorPairLR,
  colorPairLRDark,
  colorPairRL,
  colorPairRR,
  colorRevStrand,
  colorShortInsert,
  colorSplitReadInversion,
  colorSupplementary,
  colorUnmappedMate,
  colorUnmappedMateDark,
  createJBrowseBaseTheme,
  createJBrowseTheme,
  createJBrowseThemeFromArgs,
  defaultThemes,
  methylated5hmC,
  methylated5mC,
  tagColorPalette,
  unmethylated5mC,
} from './theme.ts'
export { default as BaseExportSvgDialog } from './BaseExportSvgDialog.tsx'
export type { BaseExportSvgOptions } from './BaseExportSvgDialog.tsx'
export { default as ExportSvgDialog } from './ExportSvgDialog.tsx'
export { useExportSvgPreference } from './useExportSvgPreference.ts'
export { LogoFull, Logomark } from './Logo.tsx'
export { default as AssemblySelector } from './AssemblySelector.tsx'
export { useAssemblySelection } from './useAssemblySelection.ts'
export { useRecentLocations } from './useRecentLocations.ts'
export type { RecentLocation } from './useRecentLocations.ts'
export {
  RefNameAutocompleteEndAdornment,
  adornmentReservePx,
  getInputWidth,
  default as RefNameAutocomplete,
} from './RefNameAutocomplete/index.tsx'
export { default as CascadingMenu } from './CascadingMenu.tsx'
export { default as CascadingMenuButton } from './CascadingMenuButton.tsx'
export { default as ContextMenu } from './ContextMenu.tsx'
export type { ContextMenuAnchor } from './ContextMenu.tsx'
export { CONTEXT_MENU_Z_INDEX, TOOLTIP_Z_INDEX } from './zIndexes.ts'
export { default as ConfirmDialog } from './ConfirmDialog.tsx'
export { default as JexlFilterDialog } from './JexlFilterDialog.tsx'
export { default as CopyToClipboardButton } from './CopyToClipboardButton.tsx'
export { useCopyToClipboard } from './useCopyToClipboard.ts'
export { default as Dialog } from './Dialog.tsx'
export { default as EditableTypography } from './EditableTypography.tsx'
export { default as ErrorBanner } from './ErrorBanner.tsx'
export { default as GpuFallbackButton } from './GpuFallbackButton.tsx'
export { default as ErrorMessage } from './ErrorMessage.tsx'
export { default as FatalErrorDialog } from './FatalErrorDialog.tsx'
export { default as FileSelector } from './FileSelector/FileSelector.tsx'
export { default as FileDropZone } from './FileDropZone.tsx'
export { default as LabeledCheckbox } from './LabeledCheckbox.tsx'
export { default as LoadingEllipses } from './LoadingEllipses.tsx'
export { default as LoadingProgress } from './LoadingProgress.tsx'
export { default as ViewLoadingScreen } from './ViewLoadingScreen.tsx'
export { default as ProgressChip } from './ProgressChip.tsx'
export { default as NumberTextField } from './NumberTextField.tsx'
export { type TagQuickPick, default as TagTextField } from './TagTextField.tsx'
export { default as MonospaceTextField } from './MonospaceTextField.tsx'
export { default as ShareLinkField } from './ShareLinkField.tsx'
export { default as SingleSlider } from './SingleSlider.tsx'
export { default as SliderTooltip } from './SliderTooltip.tsx'
export {
  makePromotableSizeMenu,
  makeSizeMenu,
  makeSizeSubMenu,
} from './makeSizeMenu.tsx'
export {
  INLINE_MENU_ROW_WIDTH,
  ResetToDefaultButton,
} from './InlineMenuControls.tsx'
export { sliderScale } from './sliderScale.ts'
export type { SliderScale } from './sliderScale.ts'
export { default as ErrorBar } from './ErrorBar.tsx'
export { default as ErrorOverlay } from './ErrorOverlay.tsx'
export { default as LoadingOverlay } from './LoadingOverlay.tsx'
export { default as StatusProgressBar } from './StatusProgressBar.tsx'
export { default as Menu } from './Menu.tsx'
export { default as PrerenderedCanvas } from './PrerenderedCanvas.tsx'
export { default as ResizeHandle } from './ResizeHandle.tsx'
export { default as ScrollEdgeShadow } from './ScrollEdgeShadow.tsx'
export { default as VerticalScrollbar } from './VerticalScrollbar.tsx'
export { default as SubmitDialog } from './SubmitDialog.tsx'
export { default as SubmitForm } from './SubmitForm.tsx'
export { default as ReplaceCurrentViewButton } from './ReplaceCurrentViewButton.tsx'
export { replaceViewAction } from './replaceViewAction.tsx'
export { default as InfoDialog } from './InfoDialog.tsx'
export { default as SettingsChangesTable } from './SettingsChangesTable.tsx'
export { default as ActionLink } from './ActionLink.tsx'
export { default as ExternalLink } from './ExternalLink.tsx'
export { default as SanitizedHTML } from './SanitizedHTML.tsx'
// BaseTooltip is deliberately NOT re-exported here: it reaches @floating-ui
// (~266KB), and this barrel is imported by eager plugin entries, so the
// re-export alone held that dependency on the startup path. Every consumer
// deep-imports '@jbrowse/core/ui/BaseTooltip' instead.
export { default as PluggableComponent } from './PluggableComponent.tsx'
export { default as PluggableComponents } from './PluggableComponents.tsx'
export type { ComponentExtensionPointName } from './PluggableComponents.tsx'
export { default as PluggableElements } from './PluggableElements.tsx'
export { addExtensionElement } from './addExtensionElement.tsx'
export type { ElementExtensionPointName } from './addExtensionElement.tsx'
export { wrapComponent } from './wrapComponent.tsx'
export type {
  SlotExtensionPointName,
  SlotProps,
  WrapperProps,
} from './wrapComponent.tsx'
export { matchesTrackSelector } from './extensionSelectors.ts'
export type { TrackSelector } from './extensionSelectors.ts'
export type {
  BaseMenuItem,
  CheckboxMenuItem,
  ClickableMenuItem,
  CustomMenuItem,
  MenuDivider,
  MenuItem,
  MenuItemClickHandler,
  MenuItemsGetter,
  MenuSubHeader,
  NormalMenuItem,
  RadioMenuItem,
  SubMenuItem,
} from './MenuTypes.ts'
export { resolveSubMenu, staysOpenOnClick } from './MenuTypes.ts'
export {
  LAUNCH_LABEL,
  pushIntoSubMenu,
  pushLaunchViewMenuItem,
} from './launchViewMenu.ts'
export { launchTargetsMenuItem } from './launchTargetsMenuItem.ts'
export { default as Crosshairs } from './Crosshairs.tsx'
export { hoverBoxStyle } from './hoverBoxStyle.ts'
export { useMouseState, useMouseTracking } from './useMouseTracking.ts'
export type { MouseState, MouseTracker } from './useMouseTracking.ts'
export { PinAdornment } from './PinAdornment.tsx'
export {
  promotableRadioItem,
  promotableRadioItems,
  promotableToggleItem,
} from './promotableMenuItems.ts'
// Not on the React-free `menuItems.ts` entry beside the two builders above: this
// reads a config's slot table, so it pulls `configuration/promotableSlots.ts`
// in, and that entry exists precisely to stay out of every plugin's eager graph.
//
// `pinnedSlots`, the walk underneath it, stays module-private: the question a
// caller has is "which promotable slots does this menu miss", and answering the
// half of it that lists what a menu *does* offer needs the schema's slot table
// to mean anything.
export {
  displayTypesWithPromotableSlots,
  promotableSlotsWithoutPin,
} from './promotablePinCoverage.ts'
export const VIEW_HEADER_HEIGHT = 28
export {
  GRADIENT_LEGEND_HEIGHT,
  GRADIENT_LEGEND_SVG_AREA_WIDTH,
  GRADIENT_LEGEND_WIDTH,
  default as SvgGradientLegend,
} from './SvgGradientLegend.tsx'
export type { GradientLabel, GradientStop } from './SvgGradientLegend.tsx'
export {
  LEGEND_ROW_HEIGHT,
  LEGEND_SWATCH,
  default as SvgColorLegend,
} from './SvgColorLegend.tsx'
export type { ColorLegendEntry } from './SvgColorLegend.tsx'
export { measureLegendText } from './measureLegendText.ts'
export { LegendSwatchGlyph } from './LegendSwatchGlyph.tsx'
export {
  MAX_LEGEND_ITEMS,
  legendEntries,
  legendIsReadable,
  legendSwatches,
  nonEmptyLegendSections,
} from './legendSpec.ts'
export type {
  LegendItem,
  LegendMark,
  LegendSection,
  LegendSpec,
  LegendSwatch,
} from './legendSpec.ts'
export { checkboxItem, radioItems } from './toggleMenuItems.ts'
