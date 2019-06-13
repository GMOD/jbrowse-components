import JBrowse1 from '@gmod/jbrowse-plugin-jbrowse1'
import DataManagement from '@gmod/jbrowse-plugin-data-management'
import ConfigEditing from '@gmod/jbrowse-plugin-config-editing'
import TrackHubRegistry from '@gmod/jbrowse-plugin-trackhub-registry'
import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'
import Alignments from '@gmod/jbrowse-plugin-alignments'
import Sequence from '@gmod/jbrowse-plugin-sequence'
import Bed from '@gmod/jbrowse-plugin-bed'
import Wiggle from '@gmod/jbrowse-plugin-wiggle'

import MainMenuBarPlugin from './plugins/MainMenuBar'

// adapters
import FromConfigAdapterPlugin from './plugins/FromConfigAdapter'

// tracks
import FilteringTrackPlugin from './plugins/FilteringTrack'

// renderers
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import LollipopRendererPlugin from './plugins/LollipopRenderer'

export default [
  Alignments,
  Sequence,
  DataManagement,
  ConfigEditing,
  MainMenuBarPlugin,
  Bed,
  LinearGenomeView,
  SvgFeaturePlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  LollipopRendererPlugin,
  JBrowse1,
  TrackHubRegistry,
  Wiggle,
]
