// this is all the stuff that the pluginManager re-exports for plugins to use
import React from 'react'
import * as mobx from 'mobx'
import * as mst from 'mobx-state-tree'
import * as mxreact from 'mobx-react'
import PropTypes from 'prop-types'

import ViewType from './pluggableElementTypes/ViewType'
import AdapterType from './pluggableElementTypes/AdapterType'
import TrackType from './pluggableElementTypes/TrackType'
import * as Configuration from './configuration'
import Plugin from './Plugin'

import * as mstTypes from './mst-types'

export default {
  mobx,
  'mobx-state-tree': mst,
  react: React,
  'mobx-react': mxreact,
  'prop-types': PropTypes,

  '@gmod/jbrowse-core/Plugin': Plugin,
  '@gmod/jbrowse-core/pluggableElementTypes/ViewType': ViewType,
  '@gmod/jbrowse-core/pluggableElementTypes/AdapterType': AdapterType,
  '@gmod/jbrowse-core/pluggableElementTypes/TrackType': TrackType,
  '@gmod/jbrowse-core/configuration': Configuration,
  '@gmod/jbrowse-core/mst-types': mstTypes,
}
