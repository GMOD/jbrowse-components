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

const Entries = {
  Accordion: lazy(() => import('@mui/material/Accordion')),
  AccordionActions: lazy(() => import('@mui/material/AccordionActions')),
  AccordionDetails: lazy(() => import('@mui/material/AccordionDetails')),
  Alert: lazy(() => import('@mui/material/Alert')),
  AlertTitle: lazy(() => import('@mui/material/AlertTitle')),
  Autocomplete: lazy(() => import('@mui/material/Autocomplete')),
  Avatar: lazy(() => import('@mui/material/Avatar')),
  AvatarGroup: lazy(() => import('@mui/material/AvatarGroup')),
  Backdrop: lazy(() => import('@mui/material/Backdrop')),
  Badge: lazy(() => import('@mui/material/Badge')),
  Box: lazy(() => import('@mui/material/Box')),
  Breadcrumbs: lazy(() => import('@mui/material/Breadcrumbs')),
  Button: lazy(() => import('@mui/material/Button')),
  ButtonGroup: lazy(() => import('@mui/material/ButtonGroup')),
  Card: lazy(() => import('@mui/material/Card')),
  CardActions: lazy(() => import('@mui/material/CardActions')),
  CardActionArea: lazy(() => import('@mui/material/CardActionArea')),
  CardContent: lazy(() => import('@mui/material/CardContent')),
  CardHeader: lazy(() => import('@mui/material/CardHeader')),
  CardMedia: lazy(() => import('@mui/material/CardMedia')),
  CircularProgress: lazy(() => import('@mui/material/CircularProgress')),
  Collapse: lazy(() => import('@mui/material/Collapse')),
  ClickAwayListener: lazy(() => import('@mui/material/ClickAwayListener')),
  Chip: lazy(() => import('@mui/material/Chip')),
  Checkbox: lazy(() => import('@mui/material/Checkbox')),
  Container: lazy(() => import('@mui/material/Container')),
  Dialog: lazy(() => import('@mui/material/Dialog')),
  DialogActions: lazy(() => import('@mui/material/DialogActions')),
  DialogTitle: lazy(() => import('@mui/material/DialogTitle')),
  DialogContent: lazy(() => import('@mui/material/DialogContent')),
  Divider: lazy(() => import('@mui/material/Divider')),
  Drawer: lazy(() => import('@mui/material/Drawer')),
  Fab: lazy(() => import('@mui/material/Fab')),
  Fade: lazy(() => import('@mui/material/Fade')),
  FilledInput: lazy(() => import('@mui/material/FilledInput')),
  FormLabel: lazy(() => import('@mui/material/FormLabel')),
  FormControl: lazy(() => import('@mui/material/FormControl')),
  FormControlLabel: lazy(() => import('@mui/material/FormControlLabel')),
  FormHelperText: lazy(() => import('@mui/material/FormHelperText')),
  FormGroup: lazy(() => import('@mui/material/FormGroup')),
  Grid: lazy(() => import('@mui/material/Grid')),
  Grow: lazy(() => import('@mui/material/Grow')),
  Icon: lazy(() => import('@mui/material/Icon')),
  IconButton: lazy(() => import('@mui/material/IconButton')),
  Input: lazy(() => import('@mui/material/Input')),
  InputBase: lazy(() => import('@mui/material/InputBase')),
  InputLabel: lazy(() => import('@mui/material/InputLabel')),
  InputAdornment: lazy(() => import('@mui/material/InputAdornment')),
  Link: lazy(() => import('@mui/material/Link')),
  LinearProgress: lazy(() => import('@mui/material/LinearProgress')),
  List: lazy(() => import('@mui/material/List')),
  ListItem: lazy(() => import('@mui/material/ListItem')),
  ListItemAvatar: lazy(() => import('@mui/material/ListItemAvatar')),
  ListItemSecondaryAction: lazy(
    () => import('@mui/material/ListItemSecondaryAction'),
  ),
  ListItemIcon: lazy(() => import('@mui/material/ListItemIcon')),
  ListSubheader: lazy(() => import('@mui/material/ListSubheader')),
  ListItemText: lazy(() => import('@mui/material/ListItemText')),
  Menu: lazy(() => import('@mui/material/Menu')),
  MenuItem: lazy(() => import('@mui/material/MenuItem')),
  MenuList: lazy(() => import('@mui/material/MenuList')),
  Modal: lazy(() => import('@mui/material/Modal')),
  NativeSelect: lazy(() => import('@mui/material/NativeSelect')),
  OutlinedInput: lazy(() => import('@mui/material/OutlinedInput')),
  Pagination: lazy(() => import('@mui/material/Pagination')),
  PaginationItem: lazy(() => import('@mui/material/PaginationItem')),
  Paper: lazy(() => import('@mui/material/Paper')),
  Popover: lazy(() => import('@mui/material/Popover')),
  Popper: lazy(() => import('@mui/material/Popper')),
  Portal: lazy(() => import('@mui/material/Portal')),
  Radio: lazy(() => import('@mui/material/Radio')),
  RadioGroup: lazy(() => import('@mui/material/RadioGroup')),
  Rating: lazy(() => import('@mui/material/Rating')),
  ScopedCssBaseline: lazy(() => import('@mui/material/ScopedCssBaseline')),
  Select: lazy(() => import('@mui/material/Select')),
  Skeleton: lazy(() => import('@mui/material/Skeleton')),
  Slider: lazy(() => import('@mui/material/Slider')),
  Snackbar: lazy(() => import('@mui/material/Snackbar')),
  SnackbarContent: lazy(() => import('@mui/material/SnackbarContent')),
  SpeedDial: lazy(() => import('@mui/material/SpeedDial')),
  SpeedDialAction: lazy(() => import('@mui/material/SpeedDialAction')),
  SpeedDialIcon: lazy(() => import('@mui/material/SpeedDialIcon')),
  Stack: lazy(() => import('@mui/material/Stack')),
  Step: lazy(() => import('@mui/material/Step')),
  StepButton: lazy(() => import('@mui/material/StepButton')),
  StepConnector: lazy(() => import('@mui/material/StepConnector')),
  StepLabel: lazy(() => import('@mui/material/StepLabel')),
  StepIcon: lazy(() => import('@mui/material/StepIcon')),
  Stepper: lazy(() => import('@mui/material/Stepper')),
  SvgIcon: lazy(() => import('@mui/material/SvgIcon')),
  Switch: lazy(() => import('@mui/material/Switch')),
  Tab: lazy(() => import('@mui/material/Tab')),
  Table: lazy(() => import('@mui/material/Table')),
  TableBody: lazy(() => import('@mui/material/TableBody')),
  TableCell: lazy(() => import('@mui/material/TableCell')),
  TableContainer: lazy(() => import('@mui/material/TableContainer')),
  TableFooter: lazy(() => import('@mui/material/TableFooter')),
  TableHead: lazy(() => import('@mui/material/TableHead')),
  TablePagination: lazy(() => import('@mui/material/TablePagination')),
  TableRow: lazy(() => import('@mui/material/TableRow')),
  TableSortLabel: lazy(() => import('@mui/material/TableSortLabel')),
  Tabs: lazy(() => import('@mui/material/Tabs')),
  TextField: lazy(() => import('@mui/material/TextField')),
  TextareaAutosize: lazy(() => import('@mui/material/TextareaAutosize')),
  ToggleButton: lazy(() => import('@mui/material/ToggleButton')),
  ToggleButtonGroup: lazy(() => import('@mui/material/ToggleButtonGroup')),
  Toolbar: lazy(() => import('@mui/material/Toolbar')),
  Tooltip: lazy(() => import('@mui/material/Tooltip')),
  Typography: lazy(() => import('@mui/material/Typography')),
}

const LazyMUICore = Object.fromEntries(
  Object.entries(Entries).map(([key, ReactComponent]) => [
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

  '@material-ui/core': {
    ...LazyMUICore,
    useTheme,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => {
        return useStyles().classes
      }
    },
  },
  '@mui/material': LazyMUICore,
  'prop-types': PropTypes,

  // end special case
  // material-ui subcomponents, should get rid of these
  '@mui/material/styles': MUIStyles,
  '@material-ui/core/styles': MUIStyles,
  ...MaterialPrefixMUI,
  ...MuiPrefixMUI,

  // these are core in @mui/material, but used to be in @material-ui/lab
  '@material-ui/lab/ToggleButton': Entries.ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': Entries.ToggleButtonGroup,
  '@material-ui/lab/Autocomplete': Entries.Autocomplete,

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
