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
import * as Configuration from '../configuration/index.ts'
import * as BaseAdapterExports from '../data_adapters/BaseAdapter/index.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import DisplayType from '../pluggableElementTypes/DisplayType.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import ViewType from '../pluggableElementTypes/ViewType.ts'
import WidgetType from '../pluggableElementTypes/WidgetType.ts'
import * as pluggableElementTypes from '../pluggableElementTypes/index.ts'
import * as pluggableElementTypeModels from '../pluggableElementTypes/models/index.ts'
import * as BoxRendererType from '../pluggableElementTypes/renderers/BoxRendererType.ts'
import CircularChordRendererType from '../pluggableElementTypes/renderers/CircularChordRendererType.tsx'
import * as FeatureRendererType from '../pluggableElementTypes/renderers/FeatureRendererType.ts'
import * as RendererType from '../pluggableElementTypes/renderers/RendererType.tsx'
import * as ServerSideRendererType from '../pluggableElementTypes/renderers/ServerSideRendererType.tsx'
import * as coreUi from '../ui/index.ts'
import * as coreTheme from '../ui/theme.ts'
import Base1DView from '../util/Base1DViewModel.ts'
import * as coreColor from '../util/color/index.ts'
import * as coreUtil from '../util/index.ts'
import * as coreIo from '../util/io/index.ts'
import * as coreLayouts from '../util/layouts/index.ts'
import * as coreMstReflection from '../util/mst-reflection.ts'
import * as rxjs from '../util/rxjs.ts'
import * as trackUtils from '../util/tracks.ts'
import { cx, keyframes, makeStyles } from '../util/tss-react/index.ts'
import * as mstTypes from '../util/types/mst.ts'

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

  '@jbrowse/core/Plugin': Plugin,
  '@jbrowse/core/pluggableElementTypes/renderers/RendererType': RendererType,
  '@jbrowse/core/configuration': Configuration,
  '@jbrowse/core/util/types/mst': mstTypes,
  '@jbrowse/core/ui': coreUi,
  '@jbrowse/core/ui/theme': coreTheme,
  '@jbrowse/core/util': coreUtil,
  '@jbrowse/core/util/color': coreColor,
  '@jbrowse/core/util/layouts': coreLayouts,
  '@jbrowse/core/util/tracks': trackUtils,
  '@jbrowse/core/util/Base1DViewModel': Base1DView,
  '@jbrowse/core/util/io': coreIo,
  '@jbrowse/core/util/mst-reflection': coreMstReflection,
  '@jbrowse/core/util/rxjs': rxjs,
  '@jbrowse/core/pluggableElementTypes': pluggableElementTypes,
  '@jbrowse/core/pluggableElementTypes/ViewType': ViewType,
  '@jbrowse/core/pluggableElementTypes/AdapterType': AdapterType,
  '@jbrowse/core/pluggableElementTypes/DisplayType': DisplayType,
  '@jbrowse/core/pluggableElementTypes/TrackType': TrackType,
  '@jbrowse/core/pluggableElementTypes/WidgetType': WidgetType,
  '@jbrowse/core/pluggableElementTypes/models': pluggableElementTypeModels,
  '@jbrowse/core/pluggableElementTypes/renderers/ServerSideRendererType':
    ServerSideRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType':
    CircularChordRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/BoxRendererType':
    BoxRendererType,
  '@jbrowse/core/pluggableElementTypes/renderers/FeatureRendererType':
    FeatureRendererType,

  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': BaseFeatureDetail,
  '@jbrowse/core/data_adapters/BaseAdapter': BaseAdapterExports,
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
