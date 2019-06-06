import NCListAdapterPlugin from '@gmod/jbrowse-plugin-nclist-adapter'
import DataManagement from '@gmod/jbrowse-plugin-data-management'
import ConfigEditing from '@gmod/jbrowse-plugin-config-editing'
import TrackHubRegistry from '@gmod/jbrowse-plugin-trackhub-registry'

import MainMenuBarPlugin from './plugins/MainMenuBar'

// adapters
import BamAdapterPlugin from './plugins/BamAdapter'
import TwoBitAdapterPlugin from './plugins/TwoBitAdapter'
import IndexedFastaAdapterPlugin from './plugins/IndexedFastaAdapter'
import BigWigAdapterPlugin from './plugins/BigWigAdapter'
import BigBedAdapterPlugin from './plugins/BigBedAdapter'
import FromConfigAdapterPlugin from './plugins/FromConfigAdapter'

// tracks
import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import SequenceTrackPlugin from './plugins/SequenceTrack'
import FilteringTrackPlugin from './plugins/FilteringTrack'
import WiggleTrackPlugin from './plugins/WiggleTrack'

// views
import LinearGenomeViewPlugin from './plugins/LinearGenomeView'

// renderers
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import PileupRendererPlugin from './plugins/PileupRenderer'
import DivSequenceRendererPlugin from './plugins/DivSequenceRenderer'
import WiggleRendererPlugin from './plugins/WiggleRenderer'
import LollipopRendererPlugin from './plugins/LollipopRenderer'

export default [
  DataManagement,
  ConfigEditing,
  MainMenuBarPlugin,
  BamAdapterPlugin,
  TwoBitAdapterPlugin,
  IndexedFastaAdapterPlugin,
  BigWigAdapterPlugin,
  BigBedAdapterPlugin,
  LinearGenomeViewPlugin,
  AlignmentsTrackPlugin,
  SequenceTrackPlugin,
  SvgFeaturePlugin,
  PileupRendererPlugin,
  DivSequenceRendererPlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  WiggleTrackPlugin,
  WiggleRendererPlugin,
  LollipopRendererPlugin,
  NCListAdapterPlugin,
  TrackHubRegistry,
]
