import * as React from 'react'

import * as mst from '@jbrowse/mobx-state-tree'
import { alpha, createTheme, useTheme } from '@mui/material'
import * as MUIStyles from '@mui/material/styles'
import * as MUIUtils from '@mui/material/utils'
import {
  useGridApiContext,
  useGridApiRef,
  useGridRootProps,
} from '@mui/x-data-grid'
import * as mobx from 'mobx'
import * as mxreact from 'mobx-react'
import * as ReactJSXRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'

import Plugin from '../Plugin.ts'
import { BaseFeatureDetail } from './BaseFeatureDetails.tsx'
import { DataGridEntries } from './MuiDataGridReExports.ts'
import { Entries } from './MuiReExports.ts'
import { lazyMap } from './lazify.tsx'
import reExportsList from './list.ts'
import * as assemblyManagerAssembly from '../assemblyManager/assembly.ts'
import * as BaseFeatureWidget from '../BaseFeatureWidget/index.ts'
import * as BaseCard from '../BaseFeatureWidget/BaseFeatureDetail/BaseCard.tsx'
import * as FeatureDetails from '../BaseFeatureWidget/BaseFeatureDetail/FeatureDetails.tsx'
import * as SimpleField from '../BaseFeatureWidget/BaseFeatureDetail/SimpleField.tsx'
import * as Configuration from '../configuration/index.ts'
import * as BaseAdapterExports from '../data_adapters/BaseAdapter/index.ts'
import * as BaseAdapterBaseOptions from '../data_adapters/BaseAdapter/BaseOptions.ts'
import * as BaseAdapterStats from '../data_adapters/BaseAdapter/stats.ts'
import * as dataAdapterCache from '../data_adapters/dataAdapterCache.ts'
import PluginManager from '../PluginManager.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import ConnectionType from '../pluggableElementTypes/ConnectionType.ts'
import DisplayType from '../pluggableElementTypes/DisplayType.ts'
import GlyphType from '../pluggableElementTypes/GlyphType.ts'
import InternetAccountType from '../pluggableElementTypes/InternetAccountType.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import ViewType from '../pluggableElementTypes/ViewType.ts'
import WidgetType from '../pluggableElementTypes/WidgetType.ts'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import * as RpcMethodTypeWithFiltersAndRenameRegions from '../pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions.ts'
import TextSearchAdapterType from '../pluggableElementTypes/TextSearchAdapterType.ts'
import * as pluggableElementTypes from '../pluggableElementTypes/index.ts'
import * as pluggableElementTypeModels from '../pluggableElementTypes/models/index.ts'
import * as BaseViewModel from '../pluggableElementTypes/models/BaseViewModel.ts'
import * as BoxRendererType from '../pluggableElementTypes/renderers/BoxRendererType.ts'
import CircularChordRendererType from '../pluggableElementTypes/renderers/CircularChordRendererType.tsx'
import * as FeatureRendererType from '../pluggableElementTypes/renderers/FeatureRendererType.ts'
import * as LayoutSession from '../pluggableElementTypes/renderers/LayoutSession.ts'
import * as RendererType from '../pluggableElementTypes/renderers/RendererType.tsx'
import * as SerializableFilterChain from '../pluggableElementTypes/renderers/util/serializableFilterChain.ts'
import * as ServerSideRendererType from '../pluggableElementTypes/renderers/ServerSideRendererType.ts'
import * as RpcManager from '../rpc/RpcManager.ts'
import * as coreRpcMethods from '../rpc/coreRpcMethods.ts'
import * as rpcMethodsUtil from '../rpc/methods/util.ts'
import * as TextSearchBaseResults from '../TextSearch/BaseResults.ts'
import * as TextSearchManager from '../TextSearch/TextSearchManager.ts'
import * as BaseTooltip from '../ui/BaseTooltip.tsx'
import * as CascadingMenuButton from '../ui/CascadingMenuButton.tsx'
import * as ColorPicker from '../ui/ColorPicker.tsx'
import * as uiColors from '../ui/colors.ts'
import * as DataGridFlexContainer from '../ui/DataGridFlexContainer.tsx'
import * as uiDialog from '../ui/Dialog.tsx'
import * as DraggableDialog from '../ui/DraggableDialog.tsx'
import * as ErrorBoundary from '../ui/ErrorBoundary.tsx'
import * as ErrorMessageStackTraceDialog from '../ui/ErrorMessageStackTraceDialog.tsx'
import * as Icons from '../ui/Icons.tsx'
import * as coreUi from '../ui/index.ts'
import * as uiMenu from '../ui/Menu.tsx'
import * as SanitizedHTML from '../ui/SanitizedHTML.tsx'
import * as coreTheme from '../ui/theme.ts'
import * as aborting from '../util/aborting.ts'
import * as Base1DUtils from '../util/Base1DUtils.ts'
import Base1DView from '../util/Base1DViewModel.ts'
import * as blockTypes from '../util/blockTypes.ts'
import * as calculateDynamicBlocks from '../util/calculateDynamicBlocks.ts'
import * as calculateStaticBlocks from '../util/calculateStaticBlocks.ts'
import * as coreColor from '../util/color/index.ts'
import * as colord from '../util/colord.ts'
import * as compositeMap from '../util/compositeMap.ts'
import * as convertCodingSequenceToPeptides from '../util/convertCodingSequenceToPeptides.ts'
import * as flatbush from '../util/flatbush/index.ts'
import * as formatFastaStrings from '../util/formatFastaStrings.ts'
import * as coreUtil from '../util/index.ts'
import * as coreIo from '../util/io/index.ts'
import * as jexlStrings from '../util/jexlStrings.ts'
import * as coreLayouts from '../util/layouts/index.ts'
import * as BaseLayout from '../util/layouts/BaseLayout.ts'
import * as GranularRectLayout from '../util/layouts/GranularRectLayout.ts'
import * as librpc from '../util/librpc.ts'
import * as coreMstReflection from '../util/mst-reflection.ts'
import * as offscreenCanvasPonyfill from '../util/offscreenCanvasPonyfill.tsx'
import * as offscreenCanvasUtils from '../util/offscreenCanvasUtils.tsx'
import * as parseLineByLine from '../util/parseLineByLine.ts'
import * as QuickLRU from '../util/QuickLRU/index.ts'
import * as range from '../util/range.ts'
import * as rxjs from '../util/rxjs.ts'
import * as simpleFeature from '../util/simpleFeature.ts'
import * as stats from '../util/stats.ts'
import * as stopToken from '../util/stopToken.ts'
import * as trackUtils from '../util/tracks.ts'
import { cx, keyframes, makeStyles } from '../util/tss-react/index.ts'
import * as tssReact from '../util/tss-react/index.ts'
import * as mstTypes from '../util/types/mst.ts'
import * as utilTypes from '../util/types/index.ts'

const libs = {
  mobx,
  '@jbrowse/mobx-state-tree': mst,
  'mobx-state-tree': mst,
  react: React,
  'react/jsx-runtime': ReactJSXRuntime,
  'react-dom': ReactDom,
  'react-dom/client': ReactDomClient,
  'mobx-react': mxreact,
  '@mui/x-data-grid': {
    useGridApiContext,
    useGridApiRef,
    useGridRootProps,
    ...lazyMap(DataGridEntries),
  },

  // special case so plugins can easily use @mui/icons-material; don't remove
  '@mui/material/utils': MUIUtils,
  '@material-ui/core/utils': MUIUtils,
  'tss-react': {
    cx,
    keyframes,
    makeStyles,
  },
  'tss-react/mui': {
    cx,
    keyframes,
    makeStyles,
  },

  '@material-ui/core': {
    ...lazyMap(Entries),
    useTheme,
    alpha,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },
  '@mui/material': {
    ...lazyMap(Entries),
    alpha,
    useTheme,
    createTheme,
  },
  ...lazyMap(Entries, '@mui/material/'),
  ...lazyMap(Entries, '@material-ui/core/'),

  '@mui/material/styles': {
    ...MUIStyles,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },
  '@material-ui/core/styles': {
    ...MUIStyles,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },

  // these are core in @mui/material, but used to be in @material-ui/lab
  '@material-ui/lab/ToggleButton': Entries.ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': Entries.ToggleButtonGroup,
  '@material-ui/lab/Autocomplete': Entries.Autocomplete,
  '@material-ui/lab/Alert': Entries.Alert,
  '@material-ui/lab': {
    Alert: Entries.Alert,
    Autocomplete: Entries.Autocomplete,
    ToggleButton: Entries.ToggleButton,
    ToggleButtonGroup: Entries.ToggleButtonGroup,
  },

  '@jbrowse/core/assemblyManager/assembly': assemblyManagerAssembly,
  '@jbrowse/core/BaseFeatureWidget': BaseFeatureWidget,
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': BaseFeatureDetail,
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard': BaseCard,
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails':
    FeatureDetails,
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/SimpleField': SimpleField,
  '@jbrowse/core/configuration': Configuration,
  '@jbrowse/core/data_adapters/BaseAdapter': BaseAdapterExports,
  '@jbrowse/core/data_adapters/BaseAdapter/BaseOptions':
    BaseAdapterBaseOptions,
  '@jbrowse/core/data_adapters/BaseAdapter/stats': BaseAdapterStats,
  '@jbrowse/core/data_adapters/dataAdapterCache': dataAdapterCache,
  '@jbrowse/core/Plugin': Plugin,
  '@jbrowse/core/PluginManager': PluginManager,
  '@jbrowse/core/pluggableElementTypes': pluggableElementTypes,
  '@jbrowse/core/pluggableElementTypes/AdapterType': AdapterType,
  '@jbrowse/core/pluggableElementTypes/ConnectionType': ConnectionType,
  '@jbrowse/core/pluggableElementTypes/DisplayType': DisplayType,
  '@jbrowse/core/pluggableElementTypes/GlyphType': GlyphType,
  '@jbrowse/core/pluggableElementTypes/InternetAccountType':
    InternetAccountType,
  '@jbrowse/core/pluggableElementTypes/RpcMethodType': RpcMethodType,
  '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions':
    RpcMethodTypeWithFiltersAndRenameRegions,
  '@jbrowse/core/pluggableElementTypes/TextSearchAdapterType':
    TextSearchAdapterType,
  '@jbrowse/core/pluggableElementTypes/TrackType': TrackType,
  '@jbrowse/core/pluggableElementTypes/ViewType': ViewType,
  '@jbrowse/core/pluggableElementTypes/WidgetType': WidgetType,
  '@jbrowse/core/pluggableElementTypes/models': pluggableElementTypeModels,
  '@jbrowse/core/pluggableElementTypes/models/BaseViewModel': BaseViewModel,
  '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType':
    BoxRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType':
    CircularChordRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType':
    FeatureRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/LayoutSession': LayoutSession,
  '@jbrowse/core/pluggableElementTypes/renderers/RendererType': RendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType':
    ServerSideRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain':
    SerializableFilterChain,
  '@jbrowse/core/rpc/RpcManager': RpcManager,
  '@jbrowse/core/rpc/coreRpcMethods': coreRpcMethods,
  '@jbrowse/core/rpc/methods/util': rpcMethodsUtil,
  '@jbrowse/core/TextSearch/BaseResults': TextSearchBaseResults,
  '@jbrowse/core/TextSearch/TextSearchManager': TextSearchManager,
  '@jbrowse/core/ui': coreUi,
  '@jbrowse/core/ui/BaseTooltip': BaseTooltip,
  '@jbrowse/core/ui/CascadingMenuButton': CascadingMenuButton,
  '@jbrowse/core/ui/ColorPicker': ColorPicker,
  '@jbrowse/core/ui/colors': uiColors,
  '@jbrowse/core/ui/DataGridFlexContainer': DataGridFlexContainer,
  '@jbrowse/core/ui/Dialog': uiDialog,
  '@jbrowse/core/ui/DraggableDialog': DraggableDialog,
  '@jbrowse/core/ui/ErrorBoundary': ErrorBoundary,
  '@jbrowse/core/ui/ErrorMessageStackTraceDialog':
    ErrorMessageStackTraceDialog,
  '@jbrowse/core/ui/Icons': Icons,
  '@jbrowse/core/ui/Menu': uiMenu,
  '@jbrowse/core/ui/SanitizedHTML': SanitizedHTML,
  '@jbrowse/core/ui/theme': coreTheme,
  '@jbrowse/core/util': coreUtil,
  '@jbrowse/core/util/aborting': aborting,
  '@jbrowse/core/util/Base1DUtils': Base1DUtils,
  '@jbrowse/core/util/Base1DViewModel': Base1DView,
  '@jbrowse/core/util/blockTypes': blockTypes,
  '@jbrowse/core/util/calculateDynamicBlocks': calculateDynamicBlocks,
  '@jbrowse/core/util/calculateStaticBlocks': calculateStaticBlocks,
  '@jbrowse/core/util/color': coreColor,
  '@jbrowse/core/util/colord': colord,
  '@jbrowse/core/util/compositeMap': compositeMap,
  '@jbrowse/core/util/convertCodingSequenceToPeptides':
    convertCodingSequenceToPeptides,
  '@jbrowse/core/util/flatbush': flatbush,
  '@jbrowse/core/util/formatFastaStrings': formatFastaStrings,
  '@jbrowse/core/util/io': coreIo,
  '@jbrowse/core/util/jexlStrings': jexlStrings,
  '@jbrowse/core/util/layouts': coreLayouts,
  '@jbrowse/core/util/layouts/BaseLayout': BaseLayout,
  '@jbrowse/core/util/layouts/GranularRectLayout': GranularRectLayout,
  '@jbrowse/core/util/librpc': librpc,
  '@jbrowse/core/util/mst-reflection': coreMstReflection,
  '@jbrowse/core/util/offscreenCanvasPonyfill': offscreenCanvasPonyfill,
  '@jbrowse/core/util/offscreenCanvasUtils': offscreenCanvasUtils,
  '@jbrowse/core/util/parseLineByLine': parseLineByLine,
  '@jbrowse/core/util/QuickLRU': QuickLRU,
  '@jbrowse/core/util/range': range,
  '@jbrowse/core/util/rxjs': rxjs,
  '@jbrowse/core/util/simpleFeature': simpleFeature,
  '@jbrowse/core/util/stats': stats,
  '@jbrowse/core/util/stopToken': stopToken,
  '@jbrowse/core/util/tracks': trackUtils,
  '@jbrowse/core/util/tss-react': tssReact,
  '@jbrowse/core/util/types': utilTypes,
  '@jbrowse/core/util/types/mst': mstTypes,
}

const libsList = Object.keys(libs)

// make sure that all the items in the ReExports/list array (used by build
// systems and such) are included here, and vice versa
const inLibsOnly = libsList.filter(mod => !reExportsList.includes(mod))
if (inLibsOnly.length > 0) {
  throw new Error(
    `The following modules are in the modules libs, but not the re-exports list: ${inLibsOnly.join(
      ', ',
    )}`,
  )
}
const inReExportsOnly = reExportsList.filter(mod => !libsList.includes(mod))
if (inReExportsOnly.length) {
  throw new Error(
    `The following modules are in the re-exports list, but not the modules libs: ${inReExportsOnly.join(
      ', ',
    )}`,
  )
}

export default libs
