// this is all the stuff that the pluginManager re-exports for plugins to use
import React, { lazy, Suspense } from 'react'
import * as ReactDom from 'react-dom'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import PropTypes from 'prop-types'

import * as MUIStyles from '@mui/material/styles'
import * as MUIUtils from '@mui/material/utils'
import { useTheme } from '@mui/material'

// material-ui lab
import * as BaseAdapterExports from '../data_adapters/BaseAdapter'

import Base1DView from '../util/Base1DViewModel'
import * as pluggableElementTypes from '../pluggableElementTypes'
import ViewType from '../pluggableElementTypes/ViewType'
import AdapterType from '../pluggableElementTypes/AdapterType'
import DisplayType from '../pluggableElementTypes/DisplayType'
import TrackType from '../pluggableElementTypes/TrackType'
import WidgetType from '../pluggableElementTypes/WidgetType'

import * as pluggableElementTypeModels from '../pluggableElementTypes/models'
import * as ServerSideRendererType from '../pluggableElementTypes/renderers/ServerSideRendererType'
import CircularChordRendererType from '../pluggableElementTypes/renderers/CircularChordRendererType'
import * as BoxRendererType from '../pluggableElementTypes/renderers/BoxRendererType'
import * as FeatureRendererType from '../pluggableElementTypes/renderers/FeatureRendererType'
import * as RendererType from '../pluggableElementTypes/renderers/RendererType'

import * as Configuration from '../configuration'
import Plugin from '../Plugin'
import * as coreUi from '../ui'
import * as coreUtil from '../util'
import * as coreColor from '../util/color'
import * as coreLayouts from '../util/layouts'
import * as trackUtils from '../util/tracks'
import * as coreIo from '../util/io'
import * as coreMstReflection from '../util/mst-reflection'
import * as rxjs from '../util/rxjs'
import * as mstTypes from '../util/types/mst'

import ReExportsList from './list'

const SvgIcon = lazy(() => import('@mui/material/SvgIcon'))
const Box = lazy(() => import('@mui/material/Box'))
const Button = lazy(() => import('@mui/material/Button'))
const ButtonGroup = lazy(() => import('@mui/material/ButtonGroup'))
const Card = lazy(() => import('@mui/material/Card'))
const CardContent = lazy(() => import('@mui/material/CardContent'))
const Checkbox = lazy(() => import('@mui/material/Checkbox'))
const Container = lazy(() => import('@mui/material/Container'))
const Dialog = lazy(() => import('@mui/material/Dialog'))
const DialogActions = lazy(() => import('@mui/material/DialogActions'))
const DialogTitle = lazy(() => import('@mui/material/DialogTitle'))
const DialogContent = lazy(() => import('@mui/material/DialogContent'))
const FormLabel = lazy(() => import('@mui/material/FormLabel'))
const FormControl = lazy(() => import('@mui/material/FormControl'))
const FormControlLabel = lazy(() => import('@mui/material/FormControlLabel'))
const FormGroup = lazy(() => import('@mui/material/FormGroup'))
const Grid = lazy(() => import('@mui/material/Grid'))
const Icon = lazy(() => import('@mui/material/Icon'))
const IconButton = lazy(() => import('@mui/material/IconButton'))
const InputAdornment = lazy(() => import('@mui/material/InputAdornment'))
const Link = lazy(() => import('@mui/material/Link'))
const LinearProgress = lazy(() => import('@mui/material/LinearProgress'))
const ListItemIcon = lazy(() => import('@mui/material/ListItemIcon'))
const ListItemText = lazy(() => import('@mui/material/ListItemText'))
const Menu = lazy(() => import('@mui/material/Menu'))
const MenuItem = lazy(() => import('@mui/material/MenuItem'))
const Paper = lazy(() => import('@mui/material/Paper'))
const Radio = lazy(() => import('@mui/material/Radio'))
const RadioGroup = lazy(() => import('@mui/material/RadioGroup'))
const Select = lazy(() => import('@mui/material/Select'))
const Snackbar = lazy(() => import('@mui/material/Snackbar'))
const SnackbarContent = lazy(() => import('@mui/material/SnackbarContent'))
const TextField = lazy(() => import('@mui/material/TextField'))
const ToggleButton = lazy(() => import('@mui/material/ToggleButton'))
const ToggleButtonGroup = lazy(() => import('@mui/material/ToggleButtonGroup'))
const Tooltip = lazy(() => import('@mui/material/Tooltip'))
const Typography = lazy(() => import('@mui/material/Typography'))

const LazyMUICore = Object.fromEntries(
  Object.entries({
    Box,
    Button,
    ButtonGroup,
    Card,
    CardContent,
    Checkbox,
    Container,
    Dialog,
    DialogActions,
    DialogTitle,
    DialogContent,
    FormLabel,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    Icon,
    IconButton,
    InputAdornment,
    LinearProgress,
    ListItemIcon,
    ListItemText,
    Link,
    Menu,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Select,
    Snackbar,
    SnackbarContent,
    SvgIcon,
    TextField,
    Tooltip,
    Typography,
  }).map(([key, ReactComponent]) => [
    key,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => (
      <Suspense fallback={<div />}>
        <ReactComponent {...props} />
      </Suspense>
    ),
  ]),
)

const MaterialPrefixMUI = Object.fromEntries(
  Object.entries(LazyMUICore).map(([key, value]) => [
    '@material-ui/core/' + key,
    value,
  ]),
)

const MuiPrefixMUI = Object.fromEntries(
  Object.entries(LazyMUICore).map(([key, value]) => [
    '@mui/material/' + key,
    value,
  ]),
)

const Attributes = lazy(() => import('./Attributes'))

// uses 'as any' because otherwise typescript gives warning Exported variable
// 'libs' has or is using name 'DataGridComponent' from external module
// "node_modules/@mui/x-data-grid/DataGrid/DataGrid" but cannot be named.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DataGrid = lazy(() => import('./DataGrid')) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LazyAttributes = (props: any) => (
  <Suspense fallback={<div />}>
    <Attributes {...props} />
  </Suspense>
)
const libs = {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'react-dom': ReactDom,
  'mobx-react': mxreact,
  '@mui/x-data-grid': { DataGrid },

  // special case so plugins can easily use @mui/icons-material; don't remove
  '@mui/material/utils': MUIUtils,
  '@material-ui/core/utils': MUIUtils,

  '@material-ui/core': { ...LazyMUICore, useTheme, makeStyles },
  '@mui/material': LazyMUICore,
  'prop-types': PropTypes,

  // end special case
  // material-ui subcomponents, should get rid of these
  '@mui/material/styles': MUIStyles,
  '@material-ui/core/styles': MUIStyles,
  ...MaterialPrefixMUI,
  ...MuiPrefixMUI,

  // these are core in @mui/material, but used to be in @material-ui/lab
  '@material-ui/lab/ToggleButton': ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': ToggleButtonGroup,

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
  '@jbrowse/core/util': coreUtil,
  '@jbrowse/core/util/color': coreColor,
  '@jbrowse/core/util/layouts': coreLayouts,
  '@jbrowse/core/util/tracks': trackUtils,
  '@jbrowse/core/util/Base1DViewModel': Base1DView,
  '@jbrowse/core/util/io': coreIo,
  '@jbrowse/core/util/mst-reflection': coreMstReflection,
  '@jbrowse/core/util/rxjs': rxjs,

  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': {
    Attributes: LazyAttributes,
  },
  '@jbrowse/core/data_adapters/BaseAdapter': BaseAdapterExports,
}

// make sure that all the items in the ReExports/list array (used by build systems and such)
// are included here. it's OK if there are some additional ones that are not in the list
ReExportsList.forEach(name => {
  if (!(name in libs)) {
    throw new Error(`ReExports/modules is missing ${name}`)
  }
})

export default libs
