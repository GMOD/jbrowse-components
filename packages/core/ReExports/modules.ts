// this is all the stuff that the pluginManager re-exports for plugins to use
import React from 'react'
import * as ReactDom from 'react-dom'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import PropTypes from 'prop-types'

import * as MUIStyles from '@material-ui/core/styles'

// @material-ui components
import * as MUICore from '@material-ui/core'
import * as MUIUtils from '@material-ui/core/utils'
import MUISvgIcon from '@material-ui/core/SvgIcon'
import * as MUILab from '@material-ui/lab'
import * as MUIDataGrid from '@material-ui/data-grid'
import MUIBox from '@material-ui/core/Box'
import MUIButton from '@material-ui/core/Button'
import MUIButtonGroup from '@material-ui/core/ButtonGroup'
import MUICard from '@material-ui/core/Card'
import MUICardContent from '@material-ui/core/CardContent'
import MUICheckbox from '@material-ui/core/Checkbox'
import MUIContainer from '@material-ui/core/Container'
import MUIDialog from '@material-ui/core/Dialog'
import MUIFormLabel from '@material-ui/core/FormLabel'
import MUIFormControl from '@material-ui/core/FormControl'
import MUIFormControlLabel from '@material-ui/core/FormControlLabel'
import MUIFormGroup from '@material-ui/core/FormGroup'
import MUIGrid from '@material-ui/core/Grid'
import MUIIcon from '@material-ui/core/Icon'
import MUIIconButton from '@material-ui/core/IconButton'
import MUIInputAdornment from '@material-ui/core/InputAdornment'
import MUILinearProgress from '@material-ui/core/LinearProgress'
import MUIListItemIcon from '@material-ui/core/ListItemIcon'
import MUIListItemText from '@material-ui/core/ListItemText'
import MUIMenu from '@material-ui/core/Menu'
import MUIMenuItem from '@material-ui/core/MenuItem'
import MUIRadio from '@material-ui/core/Radio'
import MUIRadioGroup from '@material-ui/core/RadioGroup'
import MUISelect from '@material-ui/core/Select'
import MUISnackbar from '@material-ui/core/Snackbar'
import MUISnackbarContent from '@material-ui/core/SnackbarContent'
import MUITextField from '@material-ui/core/TextField'
import MUITooltip from '@material-ui/core/Tooltip'
import MUITypography from '@material-ui/core/Typography'

// material-ui lab
import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'

import * as BaseAdapterExports from '../data_adapters/BaseAdapter'

import * as BaseFeatureDetail from '../BaseFeatureWidget/BaseFeatureDetail'

import Base1DView from '../util/Base1DViewModel'
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
import * as Plugin from '../Plugin'
import * as coreUi from '../ui'
import * as coreUtil from '../util'
import * as coreColor from '../util/color'
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
  '@material-ui/core': MUICore,
  // special case so plugins can easily use @material-ui/icons; don't remove
  '@material-ui/core/SvgIcon': MUISvgIcon,
  '@material-ui/core/utils': MUIUtils,
  // end special case
  '@material-ui/lab': MUILab,
  '@material-ui/data-grid': MUIDataGrid,

  // material-ui subcomponents, should get rid of these
  '@material-ui/core/colors': MUIColors,
  '@material-ui/core/styles': MUIStyles,
  '@material-ui/core/Box': MUIBox,
  '@material-ui/core/Button': MUIButton,
  '@material-ui/core/ButtonGroup': MUIButtonGroup,
  '@material-ui/core/Card': MUICard,
  '@material-ui/core/CardContent': MUICardContent,
  '@material-ui/core/Container': MUIContainer,
  '@material-ui/core/Checkbox': MUICheckbox,
  '@material-ui/core/Dialog': MUIDialog,
  '@material-ui/core/FormGroup': MUIFormGroup,
  '@material-ui/core/FormLabel': MUIFormLabel,
  '@material-ui/core/FormControl': MUIFormControl,
  '@material-ui/core/FormControlLabel': MUIFormControlLabel,
  '@material-ui/core/Grid': MUIGrid,
  '@material-ui/core/Icon': MUIIcon,
  '@material-ui/core/IconButton': MUIIconButton,
  '@material-ui/core/InputAdornment': MUIInputAdornment,
  '@material-ui/core/LinearProgress': MUILinearProgress,
  '@material-ui/core/ListItemIcon': MUIListItemIcon,
  '@material-ui/core/ListItemText': MUIListItemText,
  '@material-ui/core/Menu': MUIMenu,
  '@material-ui/core/MenuItem': MUIMenuItem,
  '@material-ui/core/RadioGroup': MUIRadioGroup,
  '@material-ui/core/Radio': MUIRadio,
  '@material-ui/core/Select': MUISelect,
  '@material-ui/core/Snackbar': MUISnackbar,
  '@material-ui/core/SnackbarContent': MUISnackbarContent,
  '@material-ui/core/TextField': MUITextField,
  '@material-ui/core/Tooltip': MUITooltip,
  '@material-ui/core/Typography': MUITypography,

  // @material-ui lab
  '@material-ui/lab/ToggleButton': ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': ToggleButtonGroup,

  '@jbrowse/core/Plugin': Plugin,
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
