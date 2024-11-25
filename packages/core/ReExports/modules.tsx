/* eslint-disable react-refresh/only-export-components */
// this is all the stuff that the pluginManager re-exports for plugins to use
import type { LazyExoticComponent } from 'react'
import React, { lazy, Suspense } from 'react'
import { useTheme } from '@mui/material'
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
import { makeStyles } from 'tss-react/mui'

// material-ui lab
import Plugin from '../Plugin'
import * as Configuration from '../configuration'
import * as BaseAdapterExports from '../data_adapters/BaseAdapter'

import * as pluggableElementTypes from '../pluggableElementTypes'
import reExportsList from './list'
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
import * as coreUtil from '../util'
import Base1DView from '../util/Base1DViewModel'
import * as coreColor from '../util/color'
import * as coreIo from '../util/io'
import * as coreLayouts from '../util/layouts'
import * as coreMstReflection from '../util/mst-reflection'
import * as rxjs from '../util/rxjs'
import * as trackUtils from '../util/tracks'
import * as mstTypes from '../util/types/mst'

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
  DialogContentText: lazy(() => import('@mui/material/DialogContentText')),
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
  Object.entries(Entries).map(([key, ReactComponent]) => {
    const Component = React.forwardRef((props: any, ref) => (
      <Suspense fallback={null}>
        <ReactComponent {...props} ref={ref} />
      </Suspense>
    ))
    Component.displayName = key
    return [key, Component]
  }),
)

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

const Attributes = lazy(
  () => import('../BaseFeatureWidget/BaseFeatureDetail/Attributes'),
)
const FeatureDetails = lazy(
  () => import('../BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'),
)
const BaseCard = lazy(
  () => import('../BaseFeatureWidget/BaseFeatureDetail/BaseCard'),
)

const DataGridEntries: Record<string, LazyExoticComponent<any>> = {
  DataGrid: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.DataGrid })),
  ),
  GridActionsCellItem: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridActionsCellItem,
    })),
  ),
  GridAddIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridAddIcon,
    })),
  ),
  GridArrowDownwardIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridArrowDownwardIcon,
    })),
  ),
  GridArrowUpwardIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridArrowUpwardIcon,
    })),
  ),
  GridCellCheckboxForwardRef: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCellCheckboxForwardRef,
    })),
  ),
  GridCellCheckboxRenderer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCellCheckboxRenderer,
    })),
  ),
  GridCheckCircleIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCheckCircleIcon,
    })),
  ),
  GridCheckIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCheckIcon,
    })),
  ),
  GridCloseIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridCloseIcon,
    })),
  ),
  GridColumnHeaderSeparator: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnHeaderSeparator,
    })),
  ),
  GridColumnHeaderSortIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnHeaderSortIcon,
    })),
  ),
  GridColumnIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnIcon,
    })),
  ),
  GridColumnMenu: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnMenu,
    })),
  ),
  GridColumnMenuContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridColumnMenuContainer,
    })),
  ),
  GridDragIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridDragIcon,
    })),
  ),
  GridExpandMoreIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridExpandMoreIcon,
    })),
  ),
  GridFilterAltIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterAltIcon,
    })),
  ),
  GridFilterForm: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterForm,
    })),
  ),
  GridFilterListIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterListIcon,
    })),
  ),
  GridFilterPanel: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFilterPanel,
    })),
  ),
  GridFooter: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridFooter })),
  ),
  GridFooterContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridFooterContainer,
    })),
  ),
  GridHeader: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridHeader })),
  ),
  GridHeaderCheckbox: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridHeaderCheckbox,
    })),
  ),
  GridKeyboardArrowRight: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridKeyboardArrowRight,
    })),
  ),
  GridLoadIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridLoadIcon,
    })),
  ),
  GridLoadingOverlay: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridLoadingOverlay,
    })),
  ),
  GridMenuIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridMenuIcon,
    })),
  ),
  GridMoreVertIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridMoreVertIcon,
    })),
  ),
  GridNoRowsOverlay: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridNoRowsOverlay,
    })),
  ),
  GridOverlay: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridOverlay,
    })),
  ),
  GridPagination: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridPagination,
    })),
  ),
  GridPanel: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridPanel })),
  ),
  GridPanelWrapper: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridPanelWrapper,
    })),
  ),
  GridRemoveIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridRemoveIcon,
    })),
  ),
  GridRoot: lazy(() =>
    import('@mui/x-data-grid').then(module => ({ default: module.GridRoot })),
  ),
  GridRowCount: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridRowCount,
    })),
  ),
  GridSaveAltIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSaveAltIcon,
    })),
  ),
  GridSearchIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSearchIcon,
    })),
  ),
  GridSelectedRowCount: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSelectedRowCount,
    })),
  ),
  GridSeparatorIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridSeparatorIcon,
    })),
  ),
  GridTableRowsIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridTableRowsIcon,
    })),
  ),
  GridToolbar: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbar,
    })),
  ),
  GridToolbarColumnsButton: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarColumnsButton,
    })),
  ),
  GridToolbarContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarContainer,
    })),
  ),
  GridToolbarDensitySelector: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarDensitySelector,
    })),
  ),
  GridToolbarExport: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarExport,
    })),
  ),
  GridToolbarExportContainer: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarExportContainer,
    })),
  ),
  GridToolbarFilterButton: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridToolbarFilterButton,
    })),
  ),
  GridTripleDotsVerticalIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridTripleDotsVerticalIcon,
    })),
  ),
  GridViewHeadlineIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridViewHeadlineIcon,
    })),
  ),
  GridViewStreamIcon: lazy(() =>
    import('@mui/x-data-grid').then(module => ({
      default: module.GridViewStreamIcon,
    })),
  ),
}

const LazyDataGridComponents = Object.fromEntries(
  Object.entries(DataGridEntries).map(([key, ReactComponent]) => {
    const Component = React.forwardRef((props: any, ref) => (
      <Suspense fallback={null}>
        <ReactComponent {...props} ref={ref} />
      </Suspense>
    ))
    Component.displayName = key
    return [key, Component]
  }),
)

const LazyAttributes = React.forwardRef((props: any, ref) => (
  <Suspense fallback={null}>
    <Attributes {...props} ref={ref} />
  </Suspense>
))
LazyAttributes.displayName = 'Attributes'

const LazyFeatureDetails = React.forwardRef((props: any, ref) => (
  <Suspense fallback={null}>
    <FeatureDetails {...props} ref={ref} />
  </Suspense>
))
LazyFeatureDetails.displayName = 'FeatureDetails'

const LazyBaseCard = React.forwardRef((props: any, ref) => (
  <Suspense fallback={null}>
    <BaseCard {...props} ref={ref} />
  </Suspense>
))
LazyBaseCard.displayName = 'BaseCard'

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
    ...LazyDataGridComponents,
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
    FeatureDetails: LazyFeatureDetails,
    BaseCard: LazyBaseCard,
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
