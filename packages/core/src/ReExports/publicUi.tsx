// The published `@jbrowse/core/ui` module, listed by name. Same split, and the
// same reasons, as publicUtil.ts: an internal barrel and an external ABI want
// opposite things, and serving `import * as coreUi from '../ui/index.ts'` made
// the second a side effect of the first.
//
// That coupling has a second cost here that util does not have, and it is the
// one that keeps biting: **removing a component from ui/index.ts is how this
// codebase does lazy loading.** The barrel is imported by eagerly-evaluated
// plugin entries, so a re-export of a heavy component holds it on the startup
// path -- that is why BaseTooltip left (the line alone held ~266KB of
// @floating-ui). With the ABI derived from the barrel, every such fix was also a
// silent ABI removal. BaseTooltip's spent two releases missing from the served
// namespace while apollo read it there.
//
// Splitting them makes those independent. Deleting an `export … from` line in
// ui/index.ts now stops compiling here, so the ABI question is asked; and the
// answer can be `lazy()`, since **this file may serve a component the barrel
// does not export** -- see BaseTooltip below, which is exactly that. The eager
// win and the plugin surface stop being the same edit.
//
// So: adding a line is how a component becomes public, and it is a decision
// rather than a side effect of where the code happens to live.
import { Suspense, lazy } from 'react'

import type { ComponentProps } from 'react'

// Deliberately not re-exported by ui/index.ts -- see above. Served from its own
// path too ('@jbrowse/core/ui/BaseTooltip', which published react-msaview uses),
// and read off this namespace by published apollo; both spellings are this one
// component, and neither puts @floating-ui on the startup path.
const LazyBaseTooltip = lazy(() => import('../ui/BaseTooltip.tsx'))

export function BaseTooltip(props: ComponentProps<typeof LazyBaseTooltip>) {
  return (
    <Suspense fallback={null}>
      <LazyBaseTooltip {...props} />
    </Suspense>
  )
}

export {
  ActionLink,
  AssemblySelector,
  BaseExportSvgDialog,
  CONTEXT_MENU_Z_INDEX,
  CascadingMenu,
  CascadingMenuButton,
  ConfirmDialog,
  ContextMenu,
  CopyToClipboardButton,
  Crosshairs,
  Dialog,
  EditableTypography,
  ErrorBanner,
  ErrorBar,
  ErrorMessage,
  ErrorOverlay,
  ExportSvgDialog,
  ExternalLink,
  FatalErrorDialog,
  FileDropZone,
  FileSelector,
  GRADIENT_LEGEND_HEIGHT,
  GRADIENT_LEGEND_SVG_AREA_WIDTH,
  GRADIENT_LEGEND_WIDTH,
  GpuFallbackButton,
  INLINE_MENU_ROW_WIDTH,
  InfoDialog,
  JexlFilterDialog,
  LAUNCH_LABEL,
  LEGEND_ROW_HEIGHT,
  LEGEND_SWATCH,
  LabeledCheckbox,
  LegendSwatchGlyph,
  LoadingEllipses,
  LoadingOverlay,
  LoadingProgress,
  LogoFull,
  Logomark,
  MAX_LEGEND_ITEMS,
  Menu,
  MonospaceTextField,
  NumberTextField,
  PinAdornment,
  PluggableComponent,
  PluggableComponents,
  PluggableElements,
  PrerenderedCanvas,
  ProgressChip,
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
  ReplaceCurrentViewButton,
  ResetToDefaultButton,
  ResizeHandle,
  SanitizedHTML,
  ScrollEdgeShadow,
  SettingsChangesTable,
  ShareLinkField,
  SingleSlider,
  SliderTooltip,
  StatusProgressBar,
  SubmitDialog,
  SubmitForm,
  SvgColorLegend,
  SvgGradientLegend,
  TOOLTIP_Z_INDEX,
  TagTextField,
  VIEW_HEADER_HEIGHT,
  VerticalScrollbar,
  ViewLoadingScreen,
  addExtensionElement,
  adornmentReservePx,
  checkboxItem,
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
  displayTypesWithPromotableSlots,
  getInputWidth,
  hoverBoxStyle,
  launchTargetsMenuItem,
  legendEntries,
  legendIsReadable,
  legendSwatches,
  makePromotableSizeMenu,
  makeSizeMenu,
  makeSizeSubMenu,
  matchesTrackSelector,
  measureLegendText,
  methylated5hmC,
  methylated5mC,
  nonEmptyLegendSections,
  promotableRadioItem,
  promotableRadioItems,
  promotableSlotsWithoutPin,
  promotableToggleItem,
  pushIntoSubMenu,
  pushLaunchViewMenuItem,
  radioItems,
  replaceViewAction,
  resolveSubMenu,
  sliderScale,
  staysOpenOnClick,
  tagColorPalette,
  unmethylated5mC,
  useAssemblySelection,
  useCopyToClipboard,
  useExportSvgPreference,
  useMouseState,
  useMouseTracking,
  useRecentLocations,
  wrapComponent,
} from '../ui/index.ts'
