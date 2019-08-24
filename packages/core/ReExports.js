// this is all the stuff that the pluginManager re-exports for plugins to use
import React from 'react'
import * as ReactDom from 'react-dom'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import * as mxreactlite from 'mobx-react-lite'
import PropTypes from 'prop-types'

import * as MUICore from '@material-ui/core'
import * as MUIStyles from '@material-ui/core/styles'
import ToggleButton from '@material-ui/lab/ToggleButton'

import ViewType from './pluggableElementTypes/ViewType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import ServerSideRendererType from './pluggableElementTypes/renderers/ServerSideRendererType'
import CircularChordRendererType from './pluggableElementTypes/renderers/CircularChordRendererType'
import BoxRendererType from './pluggableElementTypes/renderers/BoxRendererType'

import * as Configuration from './configuration'
import Plugin from './Plugin'
import * as coreUtil from './util'
import * as trackUtils from './util/tracks'

import * as mstTypes from './mst-types'

import ResizeHandle from './components/ResizeHandle'

export default {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'react-dom': ReactDom,
  'mobx-react': mxreact,
  'mobx-react-lite': mxreactlite,
  'prop-types': PropTypes,
  '@material-ui/core': MUICore,
  '@material-ui/core/styles': MUIStyles,
  '@material-ui/lab/ToggleButton': ToggleButton,

  '@gmod/jbrowse-core/Plugin': Plugin,
  '@gmod/jbrowse-core/pluggableElementTypes/ViewType': ViewType,
  '@gmod/jbrowse-core/pluggableElementTypes/AdapterType': AdapterType,
  '@gmod/jbrowse-core/pluggableElementTypes/TrackType': TrackType,
  '@gmod/jbrowse-core/pluggableElementTypes/renderers/ServerSideRendererType': ServerSideRendererType,
  '@gmod/jbrowse-core/pluggableElementTypes/renderers/CircularChordRendererType': CircularChordRendererType,
  '@gmod/jbrowse-core/pluggableElementTypes/renderers/BoxRendererType': BoxRendererType,
  '@gmod/jbrowse-core/configuration': Configuration,
  '@gmod/jbrowse-core/mst-types': mstTypes,
  '@gmod/jbrowse-core/util': coreUtil,
  '@gmod/jbrowse-core/util/tracks': trackUtils,
  '@gmod/jbrowse-core/components/ResizeHandle': ResizeHandle,
}
