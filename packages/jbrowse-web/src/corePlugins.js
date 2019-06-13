import NCListAdapterPlugin from '@gmod/jbrowse-plugin-nclist-adapter'
import DataManagement from '@gmod/jbrowse-plugin-data-management'
import ConfigEditing from '@gmod/jbrowse-plugin-config-editing'
import TrackHubRegistry from '@gmod/jbrowse-plugin-trackhub-registry'
import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'
import Alignments from '@gmod/jbrowse-plugin-alignments'
import Wiggle from '@gmod/jbrowse-plugin-wiggle'

import MainMenuBarPlugin from './plugins/MainMenuBar'

// adapters
import TwoBitAdapterPlugin from './plugins/TwoBitAdapter'
import IndexedFastaAdapterPlugin from './plugins/IndexedFastaAdapter'
import BigBedAdapterPlugin from './plugins/BigBedAdapter'
import FromConfigAdapterPlugin from './plugins/FromConfigAdapter'

// tracks
import SequenceTrackPlugin from './plugins/SequenceTrack'
import FilteringTrackPlugin from './plugins/FilteringTrack'

// renderers
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import DivSequenceRendererPlugin from './plugins/DivSequenceRenderer'
import LollipopRendererPlugin from './plugins/LollipopRenderer'

export default [
  Alignments,
  DataManagement,
  ConfigEditing,
  MainMenuBarPlugin,
  TwoBitAdapterPlugin,
  IndexedFastaAdapterPlugin,
  BigBedAdapterPlugin,
  LinearGenomeView,
  SequenceTrackPlugin,
  SvgFeaturePlugin,
  DivSequenceRendererPlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  LollipopRendererPlugin,
  NCListAdapterPlugin,
  TrackHubRegistry,
  Wiggle,
]
