// this is all the stuff that the pluginManager re-exports for plugins to use
import React from 'react'
import * as ReactDom from 'react-dom'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import PropTypes from 'prop-types'
import { makeStyles } from '@mui/styles'

import * as MUIStyles from '@mui/material/styles'

// @material-ui components
import * as MUICore from '@mui/material'
import * as MUIUtils from '@mui/material/utils'
import MUISvgIcon from '@mui/material/SvgIcon'
import * as MUILab from '@mui/lab'
import * as MUIDataGrid from '@mui/x-data-grid'
import MUIBox from '@mui/material/Box'
import MUIButton from '@mui/material/Button'
import MUIButtonGroup from '@mui/material/ButtonGroup'
import MUICard from '@mui/material/Card'
import MUICardContent from '@mui/material/CardContent'
import MUICheckbox from '@mui/material/Checkbox'
import MUIContainer from '@mui/material/Container'
import MUIDialog from '@mui/material/Dialog'
import MUIFormLabel from '@mui/material/FormLabel'
import MUIFormControl from '@mui/material/FormControl'
import MUIFormControlLabel from '@mui/material/FormControlLabel'
import MUIFormGroup from '@mui/material/FormGroup'
import MUIGrid from '@mui/material/Grid'
import MUIIcon from '@mui/material/Icon'
import MUIIconButton from '@mui/material/IconButton'
import MUIInputAdornment from '@mui/material/InputAdornment'
import MUILinearProgress from '@mui/material/LinearProgress'
import MUIListItemIcon from '@mui/material/ListItemIcon'
import MUIListItemText from '@mui/material/ListItemText'
import MUIMenu from '@mui/material/Menu'
import MUIMenuItem from '@mui/material/MenuItem'
import MUIRadio from '@mui/material/Radio'
import MUIRadioGroup from '@mui/material/RadioGroup'
import MUISelect from '@mui/material/Select'
import MUISnackbar from '@mui/material/Snackbar'
import MUISnackbarContent from '@mui/material/SnackbarContent'
import MUITextField from '@mui/material/TextField'
import MUITooltip from '@mui/material/Tooltip'
import MUITypography from '@mui/material/Typography'

// material-ui lab
import ToggleButton from '@mui/lab/ToggleButton'
import ToggleButtonGroup from '@mui/lab/ToggleButtonGroup'

import * as BaseAdapterExports from '../data_adapters/BaseAdapter'

import * as BaseFeatureDetail from '../BaseFeatureWidget/BaseFeatureDetail'

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
import * as MUIColors from './material-ui-colors'
import * as mstTypes from '../util/types/mst'

import ReExportsList from './list'

const libs = {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'react-dom': ReactDom,
  'mobx-react': mxreact,
  'prop-types': PropTypes,
  // material-ui 1st-level components
  '@mui/material': MUICore,
  '@material-ui/core': { ...MUICore, makeStyles },
  // special case so plugins can easily use @mui/icons-material; don't remove
  '@mui/material/SvgIcon': MUISvgIcon,
  '@mui/material/utils': MUIUtils,
  '@material-ui/core/utils': MUIUtils,
  // end special case
  '@mui/lab': MUILab,
  '@mui/x-data-grid': MUIDataGrid,
  // legacy
  '@material-ui/data-grid': MUIDataGrid,
  // material-ui subcomponents, should get rid of these
  '@mui/material/colors': MUIColors,
  '@mui/material/styles': MUIStyles,
  '@mui/material/Box': MUIBox,
  '@mui/material/Button': MUIButton,
  '@mui/material/ButtonGroup': MUIButtonGroup,
  '@mui/material/Card': MUICard,
  '@mui/material/CardContent': MUICardContent,
  '@mui/material/Container': MUIContainer,
  '@mui/material/Checkbox': MUICheckbox,
  '@mui/material/Dialog': MUIDialog,
  '@mui/material/FormGroup': MUIFormGroup,
  '@mui/material/FormLabel': MUIFormLabel,
  '@mui/material/FormControl': MUIFormControl,
  '@mui/material/FormControlLabel': MUIFormControlLabel,
  '@mui/material/Grid': MUIGrid,
  '@mui/material/Icon': MUIIcon,
  '@mui/material/IconButton': MUIIconButton,
  '@mui/material/InputAdornment': MUIInputAdornment,
  '@mui/material/LinearProgress': MUILinearProgress,
  '@mui/material/ListItemIcon': MUIListItemIcon,
  '@mui/material/ListItemText': MUIListItemText,
  '@mui/material/Menu': MUIMenu,
  '@mui/material/MenuItem': MUIMenuItem,
  '@mui/material/RadioGroup': MUIRadioGroup,
  '@mui/material/Radio': MUIRadio,
  '@mui/material/Select': MUISelect,
  '@mui/material/Snackbar': MUISnackbar,
  '@mui/material/SnackbarContent': MUISnackbarContent,
  '@mui/material/TextField': MUITextField,
  '@mui/material/Tooltip': MUITooltip,
  '@mui/material/Typography': MUITypography,
  // @material-ui lab
  '@mui/lab/ToggleButton': ToggleButton,
  '@mui/lab/ToggleButtonGroup': ToggleButtonGroup,
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
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': BaseFeatureDetail,
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
