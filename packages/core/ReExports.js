// this is all the stuff that the pluginManager re-exports for plugins to use
import React from 'react'
import * as ReactDom from 'react-dom'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import PropTypes from 'prop-types'

import * as MUICore from '@material-ui/core'
import * as MUIStyles from '@material-ui/core/styles'
import MUITextField from '@material-ui/core/TextField'
import MUIBox from '@material-ui/core/Box'
import MUIButton from '@material-ui/core/Button'
import MUIButtonGroup from '@material-ui/core/ButtonGroup'
import MUIGrid from '@material-ui/core/Grid'
import MUIIcon from '@material-ui/core/Icon'
import MUIIconButton from '@material-ui/core/IconButton'
import MUIFormLabel from '@material-ui/core/FormLabel'
import MUIFormControl from '@material-ui/core/FormControl'
import MUIFormControlLabel from '@material-ui/core/FormControlLabel'
import MUIRadio from '@material-ui/core/Radio'
import MUIRadioGroup from '@material-ui/core/RadioGroup'
import MUIFormGroup from '@material-ui/core/FormGroup'
import MUISnackbar from '@material-ui/core/Snackbar'
import MUISnackbarContent from '@material-ui/core/SnackbarContent'
import MUITypography from '@material-ui/core/Typography'
import MUIContainer from '@material-ui/core/Container'
import MUICheckbox from '@material-ui/core/Checkbox'
import MUIMenu from '@material-ui/core/Menu'
import MUIMenuItem from '@material-ui/core/MenuItem'
import MUIListItemIcon from '@material-ui/core/ListItemIcon'
import MUIListItemText from '@material-ui/core/ListItemText'
import MUIInputAdornment from '@material-ui/core/InputAdornment'

import ToggleButton from '@material-ui/lab/ToggleButton'
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup'

import ViewType from './pluggableElementTypes/ViewType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import ServerSideRendererType from './pluggableElementTypes/renderers/ServerSideRendererType'
import CircularChordRendererType from './pluggableElementTypes/renderers/CircularChordRendererType'
import BoxRendererType from './pluggableElementTypes/renderers/BoxRendererType'

import * as Configuration from './configuration'
import Plugin from './Plugin'
import * as coreUi from './ui'
import * as coreUtil from './util'
import * as trackUtils from './util/tracks'
import * as coreIo from './util/io'

import * as MUIColors from './ReExports/material-ui-colors'

import * as mstTypes from './mst-types'

import ResizeHandle from './components/ResizeHandle'

export default {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'react-dom': ReactDom,
  'mobx-react': mxreact,
  'prop-types': PropTypes,

  '@material-ui/core': MUICore,
  '@material-ui/core/styles': MUIStyles,
  '@material-ui/core/Button': MUIButton,
  '@material-ui/core/ButtonGroup': MUIButtonGroup,
  '@material-ui/core/FormGroup': MUIFormGroup,
  '@material-ui/core/FormLabel': MUIFormLabel,
  '@material-ui/core/FormControl': MUIFormControl,
  '@material-ui/core/FormControlLabel': MUIFormControlLabel,
  '@material-ui/core/Grid': MUIGrid,
  '@material-ui/core/Box': MUIBox,
  '@material-ui/core/TextField': MUITextField,
  '@material-ui/core/Icon': MUIIcon,
  '@material-ui/core/IconButton': MUIIconButton,
  '@material-ui/core/Snackbar': MUISnackbar,
  '@material-ui/core/SnackbarContent': MUISnackbarContent,
  '@material-ui/core/Typography': MUITypography,
  '@material-ui/core/Container': MUIContainer,
  '@material-ui/core/Checkbox': MUICheckbox,
  '@material-ui/core/RadioGroup': MUIRadioGroup,
  '@material-ui/core/Radio': MUIRadio,
  '@material-ui/core/Menu': MUIMenu,
  '@material-ui/core/MenuItem': MUIMenuItem,
  '@material-ui/core/ListItemIcon': MUIListItemIcon,
  '@material-ui/core/ListItemText': MUIListItemText,
  '@material-ui/core/InputAdornment': MUIInputAdornment,
  '@material-ui/core/colors': MUIColors,

  '@material-ui/lab/ToggleButton': ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': ToggleButtonGroup,

  '@gmod/jbrowse-core/Plugin': Plugin,
  '@gmod/jbrowse-core/pluggableElementTypes/ViewType': ViewType,
  '@gmod/jbrowse-core/pluggableElementTypes/AdapterType': AdapterType,
  '@gmod/jbrowse-core/pluggableElementTypes/TrackType': TrackType,
  '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType': ServerSideRendererType,
  '@gmod/jbrowse-core/pluggableElementTypes/renderers/CircularChordRendererType': CircularChordRendererType,
  '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType': BoxRendererType,
  '@gmod/jbrowse-core/configuration': Configuration,
  '@gmod/jbrowse-core/mst-types': mstTypes,
  '@gmod/jbrowse-core/ui': coreUi,
  '@gmod/jbrowse-core/util': coreUtil,
  '@gmod/jbrowse-core/util/tracks': trackUtils,
  '@gmod/jbrowse-core/util/io': coreIo,
  '@gmod/jbrowse-core/components/ResizeHandle': ResizeHandle,
}
