/* eslint-disable react-refresh/only-export-components */
// this is all the stuff that the pluginManager re-exports for plugins to use
import * as React from 'react'
import { lazy } from 'react'

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
import * as mst from 'mobx-state-tree'
import * as ReactJSXRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import { makeStyles } from 'tss-react/mui'

import Plugin from '../Plugin'
import * as Configuration from '../configuration'
import * as BaseAdapterExports from '../data_adapters/BaseAdapter'
import * as pluggableElementTypes from '../pluggableElementTypes'
import AdapterType from '../pluggableElementTypes/AdapterType'
import DisplayType from '../pluggableElementTypes/DisplayType'
import TrackType from '../pluggableElementTypes/TrackType'
import ViewType from '../pluggableElementTypes/ViewType'
import WidgetType from '../pluggableElementTypes/WidgetType'
import * as pluggableElementTypeModels from '../pluggableElementTypes/models'
import * as BoxRendererType from '../pluggableElementTypes/renderers/BoxRendererType'
import CircularChordRendererType from '../pluggableElementTypes/renderers/CircularChordRendererType'
import * as FeatureRendererType from '../pluggableElementTypes/renderers/FeatureRendererType'
import * as RendererType from '../pluggableElementTypes/renderers/RendererType'
import * as ServerSideRendererType from '../pluggableElementTypes/renderers/ServerSideRendererType'
import * as coreUi from '../ui'
import * as coreTheme from '../ui/theme'
import * as coreUtil from '../util'
import Base1DView from '../util/Base1DViewModel'
import * as coreColor from '../util/color'
import * as coreIo from '../util/io'
import * as coreLayouts from '../util/layouts'
import * as coreMstReflection from '../util/mst-reflection'
import * as rxjs from '../util/rxjs'
import * as trackUtils from '../util/tracks'
import * as mstTypes from '../util/types/mst'
import { Entries } from './MuiReExports'
import { DataGridEntries } from './MuiDataGridReExports'
import { lazyMap } from './lazify'

const r0 = lazyMap(Entries, '@mui/material/')
const r1 = lazyMap(Entries, '@material-ui/core/')

export default {
  mobx,
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
    ...lazyMap(DataGridEntries, '@mui/x-data-grid/'),
  },

  // special case so plugins can easily use @mui/icons-material; don't remove
  '@mui/material/utils': MUIUtils,
  '@material-ui/core/utils': MUIUtils,
  'tss-react/mui': {
    makeStyles,
  },

  '@material-ui/core': {
    ...r1,
    useTheme,
    alpha,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },
  '@mui/material': {
    ...r0,
    alpha,
    useTheme,
    createTheme,
  },
  ...r0,
  ...r1,

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

  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': lazyMap(
    {
      Attributes: lazy(
        () => import('../BaseFeatureWidget/BaseFeatureDetail/Attributes'),
      ),
      FeatureDetails: lazy(
        () => import('../BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'),
      ),
      BaseCard: lazy(
        () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCard'),
      ),
      BaseAttributes: lazy(
        () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseAttributes'),
      ),
      BaseCoreDetails: lazy(
        () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCoreDetails'),
      ),
    },
    '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/',
  ),
  '@jbrowse/core/data_adapters/BaseAdapter': BaseAdapterExports,
}
