// this is all the stuff that the pluginManager re-exports for plugins to use
import React from 'react'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import * as mxreactlite from 'mobx-react-lite'
import PropTypes from 'prop-types'

import * as MUICore from '@material-ui/core'
import ToggleButton from '@material-ui/lab/ToggleButton'

import ViewType from './pluggableElementTypes/ViewType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import * as Configuration from './configuration'
import Plugin from './Plugin'
import * as coreUtil from './util'
import * as trackUtils from './util/tracks'

import * as mstTypes from './mst-types'

import ResizeHandleHorizontal from './components/ResizeHandleHorizontal'

export default {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'mobx-react': mxreact,
  'mobx-react-lite': mxreactlite,
  'prop-types': PropTypes,
  '@material-ui/core': MUICore,
  '@material-ui/lab/ToggleButton': ToggleButton,

  '@gmod/jbrowse-core/Plugin': Plugin,
  '@gmod/jbrowse-core/pluggableElementTypes/ViewType': ViewType,
  '@gmod/jbrowse-core/pluggableElementTypes/AdapterType': AdapterType,
  '@gmod/jbrowse-core/pluggableElementTypes/TrackType': TrackType,
  '@gmod/jbrowse-core/configuration': Configuration,
  '@gmod/jbrowse-core/mst-types': mstTypes,
  '@gmod/jbrowse-core/util': coreUtil,
  '@gmod/jbrowse-core/util/tracks': trackUtils,
  '@gmod/jbrowse-core/components/ResizeHandleHorizontal': ResizeHandleHorizontal,
}
