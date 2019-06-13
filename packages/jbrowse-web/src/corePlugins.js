import NCListAdapterPlugin from '@gmod/jbrowse-plugin-nclist-adapter'
import DataManagement from '@gmod/jbrowse-plugin-data-management'
import ConfigEditing from '@gmod/jbrowse-plugin-config-editing'
import TrackHubRegistry from '@gmod/jbrowse-plugin-trackhub-registry'
import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'
import Alignments from '@gmod/jbrowse-plugin-alignments'
import Sequence from '@gmod/jbrowse-plugin-sequence'
import Wiggle from '@gmod/jbrowse-plugin-wiggle'

import MainMenuBarPlugin from './plugins/MainMenuBar'

// adapters
import BigBedAdapterPlugin from './plugins/BigBedAdapter'
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
  BigBedAdapterPlugin,
  LinearGenomeView,
  SvgFeaturePlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  LollipopRendererPlugin,
  NCListAdapterPlugin,
  TrackHubRegistry,
  Wiggle,
]
