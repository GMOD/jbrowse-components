/* eslint-disable react-refresh/only-export-components */
// this is all the stuff that the pluginManager re-exports for plugins to use
import React, { lazy, Suspense } from 'react'
import * as ReactJSXRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import * as MUIStyles from '@mui/material/styles'
import * as MUIUtils from '@mui/material/utils'
import { useTheme } from '@mui/material'
import {
  useGridApiContext,
  useGridApiRef,
  useGridRootProps,
} from '@mui/x-data-grid'

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

import reExportsList from './list'

const LazyMUICore: Record<string, React.FC<any>> = {
  Accordion: withLazy(lazy(() => import('@mui/material/Accordion'))),
  AccordionActions: withLazy(
    lazy(() => import('@mui/material/AccordionActions')),
  ),
  AccordionDetails: withLazy(
    lazy(() => import('@mui/material/AccordionDetails')),
  ),
  Alert: withLazy(lazy(() => import('@mui/material/Alert'))),
  AlertTitle: withLazy(lazy(() => import('@mui/material/AlertTitle'))),
  Autocomplete: withLazy(lazy(() => import('@mui/material/Autocomplete'))),
  Avatar: withLazy(lazy(() => import('@mui/material/Avatar'))),
  AvatarGroup: withLazy(lazy(() => import('@mui/material/AvatarGroup'))),
  Backdrop: withLazy(lazy(() => import('@mui/material/Backdrop'))),
  Badge: withLazy(lazy(() => import('@mui/material/Badge'))),
  Box: withLazy(lazy(() => import('@mui/material/Box'))),
  Breadcrumbs: withLazy(lazy(() => import('@mui/material/Breadcrumbs'))),
  Button: withLazy(lazy(() => import('@mui/material/Button'))),
  ButtonGroup: withLazy(lazy(() => import('@mui/material/ButtonGroup'))),
  Card: withLazy(lazy(() => import('@mui/material/Card'))),
  CardActions: withLazy(lazy(() => import('@mui/material/CardActions'))),
  CardActionArea: withLazy(lazy(() => import('@mui/material/CardActionArea'))),
  CardContent: withLazy(lazy(() => import('@mui/material/CardContent'))),
  CardHeader: withLazy(lazy(() => import('@mui/material/CardHeader'))),
  CardMedia: withLazy(lazy(() => import('@mui/material/CardMedia'))),
  CircularProgress: withLazy(
    lazy(() => import('@mui/material/CircularProgress')),
  ),
  Collapse: withLazy(lazy(() => import('@mui/material/Collapse'))),
  ClickAwayListener: withLazy(
    lazy(() => import('@mui/material/ClickAwayListener')),
  ),
  Chip: withLazy(lazy(() => import('@mui/material/Chip'))),
  Checkbox: withLazy(lazy(() => import('@mui/material/Checkbox'))),
  Container: withLazy(lazy(() => import('@mui/material/Container'))),
  Dialog: withLazy(lazy(() => import('@mui/material/Dialog'))),
  DialogActions: withLazy(lazy(() => import('@mui/material/DialogActions'))),
  DialogTitle: withLazy(lazy(() => import('@mui/material/DialogTitle'))),
  DialogContent: withLazy(lazy(() => import('@mui/material/DialogContent'))),
  DialogContentText: withLazy(
    lazy(() => import('@mui/material/DialogContentText')),
  ),
  Divider: withLazy(lazy(() => import('@mui/material/Divider'))),
  Drawer: withLazy(lazy(() => import('@mui/material/Drawer'))),
  Fab: withLazy(lazy(() => import('@mui/material/Fab'))),
  Fade: withLazy(lazy(() => import('@mui/material/Fade'))),
  FilledInput: withLazy(lazy(() => import('@mui/material/FilledInput'))),
  FormLabel: withLazy(lazy(() => import('@mui/material/FormLabel'))),
  FormControl: withLazy(lazy(() => import('@mui/material/FormControl'))),
  FormControlLabel: withLazy(
    lazy(() => import('@mui/material/FormControlLabel')),
  ),
  FormHelperText: withLazy(lazy(() => import('@mui/material/FormHelperText'))),
  FormGroup: withLazy(lazy(() => import('@mui/material/FormGroup'))),
  Grid: withLazy(lazy(() => import('@mui/material/Grid'))),
  Grow: withLazy(lazy(() => import('@mui/material/Grow'))),
  Icon: withLazy(lazy(() => import('@mui/material/Icon'))),
  IconButton: withLazy(lazy(() => import('@mui/material/IconButton'))),
  Input: withLazy(lazy(() => import('@mui/material/Input'))),
  InputBase: withLazy(lazy(() => import('@mui/material/InputBase'))),
  InputLabel: withLazy(lazy(() => import('@mui/material/InputLabel'))),
  InputAdornment: withLazy(lazy(() => import('@mui/material/InputAdornment'))),
  Link: withLazy(lazy(() => import('@mui/material/Link'))),
  LinearProgress: withLazy(lazy(() => import('@mui/material/LinearProgress'))),
  List: withLazy(lazy(() => import('@mui/material/List'))),
  ListItem: withLazy(lazy(() => import('@mui/material/ListItem'))),
  ListItemAvatar: withLazy(lazy(() => import('@mui/material/ListItemAvatar'))),
  ListItemSecondaryAction: withLazy(
    lazy(() => import('@mui/material/ListItemSecondaryAction')),
  ),
  ListItemIcon: withLazy(lazy(() => import('@mui/material/ListItemIcon'))),
  ListSubheader: withLazy(lazy(() => import('@mui/material/ListSubheader'))),
  ListItemText: withLazy(lazy(() => import('@mui/material/ListItemText'))),
  Menu: withLazy(lazy(() => import('@mui/material/Menu'))),
  MenuItem: withLazy(lazy(() => import('@mui/material/MenuItem'))),
  MenuList: withLazy(lazy(() => import('@mui/material/MenuList'))),
  Modal: withLazy(lazy(() => import('@mui/material/Modal'))),
  NativeSelect: withLazy(lazy(() => import('@mui/material/NativeSelect'))),
  OutlinedInput: withLazy(lazy(() => import('@mui/material/OutlinedInput'))),
  Pagination: withLazy(lazy(() => import('@mui/material/Pagination'))),
  PaginationItem: withLazy(lazy(() => import('@mui/material/PaginationItem'))),
  Paper: withLazy(lazy(() => import('@mui/material/Paper'))),
  Popover: withLazy(lazy(() => import('@mui/material/Popover'))),
  Popper: withLazy(lazy(() => import('@mui/material/Popper'))),
  Portal: withLazy(lazy(() => import('@mui/material/Portal'))),
  Radio: withLazy(lazy(() => import('@mui/material/Radio'))),
  RadioGroup: withLazy(lazy(() => import('@mui/material/RadioGroup'))),
  Rating: withLazy(lazy(() => import('@mui/material/Rating'))),
  ScopedCssBaseline: withLazy(
    lazy(() => import('@mui/material/ScopedCssBaseline')),
  ),
  Select: withLazy(lazy(() => import('@mui/material/Select'))),
  Skeleton: withLazy(lazy(() => import('@mui/material/Skeleton'))),
  Slider: withLazy(lazy(() => import('@mui/material/Slider'))),
  Snackbar: withLazy(lazy(() => import('@mui/material/Snackbar'))),
  SnackbarContent: withLazy(
    lazy(() => import('@mui/material/SnackbarContent')),
  ),
  SpeedDial: withLazy(lazy(() => import('@mui/material/SpeedDial'))),
  SpeedDialAction: withLazy(
    lazy(() => import('@mui/material/SpeedDialAction')),
  ),
  SpeedDialIcon: withLazy(lazy(() => import('@mui/material/SpeedDialIcon'))),
  Stack: withLazy(lazy(() => import('@mui/material/Stack'))),
  Step: withLazy(lazy(() => import('@mui/material/Step'))),
  StepButton: withLazy(lazy(() => import('@mui/material/StepButton'))),
  StepConnector: withLazy(lazy(() => import('@mui/material/StepConnector'))),
  StepLabel: withLazy(lazy(() => import('@mui/material/StepLabel'))),
  StepIcon: withLazy(lazy(() => import('@mui/material/StepIcon'))),
  Stepper: withLazy(lazy(() => import('@mui/material/Stepper'))),
  SvgIcon: withLazy(lazy(() => import('@mui/material/SvgIcon'))),
  Switch: withLazy(lazy(() => import('@mui/material/Switch'))),
  Tab: withLazy(lazy(() => import('@mui/material/Tab'))),
  Table: withLazy(lazy(() => import('@mui/material/Table'))),
  TableBody: withLazy(lazy(() => import('@mui/material/TableBody'))),
  TableCell: withLazy(lazy(() => import('@mui/material/TableCell'))),
  TableContainer: withLazy(lazy(() => import('@mui/material/TableContainer'))),
  TableFooter: withLazy(lazy(() => import('@mui/material/TableFooter'))),
  TableHead: withLazy(lazy(() => import('@mui/material/TableHead'))),
  TablePagination: withLazy(
    lazy(() => import('@mui/material/TablePagination')),
  ),
  TableRow: withLazy(lazy(() => import('@mui/material/TableRow'))),
  TableSortLabel: withLazy(lazy(() => import('@mui/material/TableSortLabel'))),
  Tabs: withLazy(lazy(() => import('@mui/material/Tabs'))),
  TextField: withLazy(lazy(() => import('@mui/material/TextField'))),
  TextareaAutosize: withLazy(
    lazy(() => import('@mui/material/TextareaAutosize')),
  ),
  ToggleButton: withLazy(lazy(() => import('@mui/material/ToggleButton'))),
  ToggleButtonGroup: withLazy(
    lazy(() => import('@mui/material/ToggleButtonGroup')),
  ),
  Toolbar: withLazy(lazy(() => import('@mui/material/Toolbar'))),
  Tooltip: withLazy(lazy(() => import('@mui/material/Tooltip'))),
  Typography: withLazy(lazy(() => import('@mui/material/Typography'))),
} as const

export function withLazy<P extends React.FC<any>>(WrappedComponent: P) {
  const Component = function (props: React.ComponentProps<P>) {
    return (
      <Suspense fallback={null}>
        <WrappedComponent {...props} />
      </Suspense>
    )
  }

  Component.displayName = `withLazy(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`
  return Component
}

const MaterialPrefixMUI = Object.fromEntries(
  Object.entries(LazyMUICore).map(([key, value]) => [
    `@material-ui/core/${key}`,
    value,
  ]),
)

const MuiPrefixMUI = Object.fromEntries(
  Object.entries(LazyMUICore).map(([key, value]) => [
    `@mui/material/${key}`,
    value,
  ]),
)

const DataGridEntries: Record<string, React.FC<any>> = {
  DataGrid: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({ default: module.DataGrid })),
    ),
  ),
  GridActionsCellItem: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridActionsCellItem,
      })),
    ),
  ),
  GridAddIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridAddIcon,
      })),
    ),
  ),
  GridArrowDownwardIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridArrowDownwardIcon,
      })),
    ),
  ),
  GridArrowUpwardIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridArrowUpwardIcon,
      })),
    ),
  ),
  GridCellCheckboxForwardRef: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridCellCheckboxForwardRef,
      })),
    ),
  ),
  GridCellCheckboxRenderer: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridCellCheckboxRenderer,
      })),
    ),
  ),
  GridCheckCircleIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridCheckCircleIcon,
      })),
    ),
  ),
  GridCheckIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridCheckIcon,
      })),
    ),
  ),
  GridCloseIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridCloseIcon,
      })),
    ),
  ),
  GridColumnHeaderSeparator: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridColumnHeaderSeparator,
      })),
    ),
  ),
  GridColumnHeaderSortIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridColumnHeaderSortIcon,
      })),
    ),
  ),
  GridColumnIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridColumnIcon,
      })),
    ),
  ),
  GridColumnMenu: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridColumnMenu,
      })),
    ),
  ),
  GridColumnMenuContainer: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridColumnMenuContainer,
      })),
    ),
  ),
  GridDragIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridDragIcon,
      })),
    ),
  ),
  GridExpandMoreIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridExpandMoreIcon,
      })),
    ),
  ),
  GridFilterAltIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridFilterAltIcon,
      })),
    ),
  ),
  GridFilterForm: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridFilterForm,
      })),
    ),
  ),
  GridFilterListIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridFilterListIcon,
      })),
    ),
  ),
  GridFilterPanel: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridFilterPanel,
      })),
    ),
  ),
  GridFooter: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridFooter,
      })),
    ),
  ),
  GridFooterContainer: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridFooterContainer,
      })),
    ),
  ),
  GridHeader: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridHeader,
      })),
    ),
  ),
  GridHeaderCheckbox: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridHeaderCheckbox,
      })),
    ),
  ),
  GridKeyboardArrowRight: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridKeyboardArrowRight,
      })),
    ),
  ),
  GridLoadIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridLoadIcon,
      })),
    ),
  ),
  GridLoadingOverlay: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridLoadingOverlay,
      })),
    ),
  ),
  GridMenuIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridMenuIcon,
      })),
    ),
  ),
  GridMoreVertIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridMoreVertIcon,
      })),
    ),
  ),
  GridNoRowsOverlay: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridNoRowsOverlay,
      })),
    ),
  ),
  GridOverlay: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridOverlay,
      })),
    ),
  ),
  GridPagination: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridPagination,
      })),
    ),
  ),
  GridPanel: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridPanel,
      })),
    ),
  ),
  GridPanelWrapper: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridPanelWrapper,
      })),
    ),
  ),
  GridRemoveIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridRemoveIcon,
      })),
    ),
  ),
  GridRoot: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({ default: module.GridRoot })),
    ),
  ),
  GridRowCount: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridRowCount,
      })),
    ),
  ),
  GridSaveAltIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridSaveAltIcon,
      })),
    ),
  ),
  GridSearchIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridSearchIcon,
      })),
    ),
  ),
  GridSelectedRowCount: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridSelectedRowCount,
      })),
    ),
  ),
  GridSeparatorIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridSeparatorIcon,
      })),
    ),
  ),
  GridTableRowsIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridTableRowsIcon,
      })),
    ),
  ),
  GridToolbar: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbar,
      })),
    ),
  ),
  GridToolbarColumnsButton: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbarColumnsButton,
      })),
    ),
  ),
  GridToolbarContainer: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbarContainer,
      })),
    ),
  ),
  GridToolbarDensitySelector: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbarDensitySelector,
      })),
    ),
  ),
  GridToolbarExport: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbarExport,
      })),
    ),
  ),
  GridToolbarExportContainer: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbarExportContainer,
      })),
    ),
  ),
  GridToolbarFilterButton: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridToolbarFilterButton,
      })),
    ),
  ),
  GridTripleDotsVerticalIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridTripleDotsVerticalIcon,
      })),
    ),
  ),
  GridViewHeadlineIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridViewHeadlineIcon,
      })),
    ),
  ),
  GridViewStreamIcon: withLazy(
    lazy(() =>
      import('@mui/x-data-grid').then(module => ({
        default: module.GridViewStreamIcon,
      })),
    ),
  ),
} as const

const libs = {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'react/jsx-runtime': ReactJSXRuntime,
  'react-dom': ReactDom,
  'mobx-react': mxreact,
  '@mui/x-data-grid': {
    useGridApiContext,
    useGridApiRef,
    useGridRootProps,
    ...DataGridEntries,
  },

  // special case so plugins can easily use @mui/icons-material; don't remove
  '@mui/material/utils': MUIUtils,
  '@material-ui/core/utils': MUIUtils,
  'tss-react/mui': { makeStyles },

  '@material-ui/core': {
    ...LazyMUICore,
    useTheme,
    alpha: MUIStyles.alpha,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },
  '@mui/material': {
    ...LazyMUICore,
    alpha: MUIStyles.alpha,
    useTheme: MUIStyles.useTheme,
  },

  // end special case
  // material-ui subcomponents, should get rid of these
  '@mui/material/styles': {
    MUIStyles,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },
  '@material-ui/core/styles': {
    MUIStyles,

    makeStyles: (args: any) => {
      const useStyles = makeStyles()(args)
      return () => useStyles().classes
    },
  },
  ...MaterialPrefixMUI,
  ...MuiPrefixMUI,

  // these are core in @mui/material, but used to be in @material-ui/lab
  '@material-ui/lab/ToggleButton': LazyMUICore.ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': LazyMUICore.ToggleButtonGroup,
  '@material-ui/lab/Autocomplete': LazyMUICore.Autocomplete,
  '@material-ui/lab/Alert': LazyMUICore.Alert,
  '@material-ui/lab': {
    Alert: LazyMUICore.Alert,
    Autocomplete: LazyMUICore.Autocomplete,
    ToggleButton: LazyMUICore.ToggleButton,
    ToggleButtonGroup: LazyMUICore.ToggleButtonGroup,
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
  '@jbrowse/core/util': coreUtil,
  '@jbrowse/core/util/color': coreColor,
  '@jbrowse/core/util/layouts': coreLayouts,
  '@jbrowse/core/util/tracks': trackUtils,
  '@jbrowse/core/util/Base1DViewModel': Base1DView,
  '@jbrowse/core/util/io': coreIo,
  '@jbrowse/core/util/mst-reflection': coreMstReflection,
  '@jbrowse/core/util/rxjs': rxjs,

  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': {
    Attributes: withLazy(
      lazy(() => import('../BaseFeatureWidget/BaseFeatureDetail/Attributes')),
    ),
    FeatureDetails: withLazy(
      lazy(
        () => import('../BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'),
      ),
    ),
    BaseCard: withLazy(
      lazy(() => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCard')),
    ),
  },
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
