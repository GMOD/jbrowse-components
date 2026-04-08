import * as React from 'react'

import * as mst from '@jbrowse/mobx-state-tree'
import { alpha, createTheme, useTheme } from '@mui/material/styles'
import * as MUIStyles from '@mui/material/styles'
import * as mobx from 'mobx'
import * as mxreact from 'mobx-react'
import * as ReactJSXRuntime from 'react/jsx-runtime'

import Plugin from '../Plugin.ts'
import workerReExportsList from './workerList.ts'
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
import * as ServerSideRendererType from '../pluggableElementTypes/renderers/ServerSideRendererType.ts'
import Base1DView from '../util/Base1DViewModel.ts'
import * as coreColor from '../util/color/index.ts'
import * as coreUtil from '../util/index.ts'
import * as coreIo from '../util/io/index.ts'
import * as coreLayouts from '../util/layouts/index.ts'
import * as coreMstReflection from '../util/mst-reflection.ts'
import * as rxjs from '../util/rxjs.ts'
import * as trackUtils from '../util/tracks.ts'
import * as mstTypes from '../util/types/mst.ts'

const libs = {
  mobx,
  '@jbrowse/mobx-state-tree': mst,
  'mobx-state-tree': mst,
  react: React,
  'react/jsx-runtime': ReactJSXRuntime,
  'mobx-react': mxreact,

  '@mui/material/styles': MUIStyles,
  '@material-ui/core/styles': MUIStyles,

  // keep theme utilities available for renderers that use colors
  '@mui/material': {
    alpha,
    useTheme,
    createTheme,
  },
  '@material-ui/core': {
    useTheme,
    alpha,
  },

  '@jbrowse/core/Plugin': Plugin,
  '@jbrowse/core/pluggableElementTypes/renderers/RendererType': RendererType,
  '@jbrowse/core/configuration': Configuration,
  '@jbrowse/core/util/types/mst': mstTypes,
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

  '@jbrowse/core/data_adapters/BaseAdapter': BaseAdapterExports,
}

const libsList = Object.keys(libs)

const inLibsOnly = libsList.filter(mod => !workerReExportsList.includes(mod))
if (inLibsOnly.length > 0) {
  throw new Error(
    `The following modules are in the worker modules libs, but not the worker re-exports list: ${inLibsOnly.join(', ')}`,
  )
}
const inReExportsOnly = workerReExportsList.filter(
  mod => !libsList.includes(mod),
)
if (inReExportsOnly.length) {
  throw new Error(
    `The following modules are in the worker re-exports list, but not the worker modules libs: ${inReExportsOnly.join(', ')}`,
  )
}

export default libs
