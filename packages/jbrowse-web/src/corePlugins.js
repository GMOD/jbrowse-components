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
import PileupRendererPlugin from './plugins/PileupRenderer'
import SvgFeaturePlugin from './plugins/SvgFeatureRenderer'
import DivSequenceRendererPlugin from './plugins/DivSequenceRenderer'
import WiggleRendererPlugin from './plugins/WiggleRenderer'

// drawer widgets
import HierarchicalTrackSelectorDrawerWidgetPlugin from './plugins/HierarchicalTrackSelectorDrawerWidget'
import DataHubManagerDrawerWidgetPlugin from './plugins/DataHubManagerDrawerWidget'
import AddTrackDrawerWidgetPlugin from './plugins/AddTrackDrawerWidget'
import ConfigurationEditorPlugin from './plugins/ConfigurationEditorDrawerWidget'
import LollipopRendererPlugin from './plugins/LollipopRenderer'

export default [
  MainMenuBarPlugin,
  HierarchicalTrackSelectorDrawerWidgetPlugin,
  BamAdapterPlugin,
  TwoBitAdapterPlugin,
  IndexedFastaAdapterPlugin,
  BigWigAdapterPlugin,
  BigBedAdapterPlugin,
  LinearGenomeViewPlugin,
  AlignmentsTrackPlugin,
  DataHubManagerDrawerWidgetPlugin,
  AddTrackDrawerWidgetPlugin,
  ConfigurationEditorPlugin,
  SequenceTrackPlugin,
  PileupRendererPlugin,
  SvgFeaturePlugin,
  DivSequenceRendererPlugin,
  FromConfigAdapterPlugin,
  FilteringTrackPlugin,
  WiggleTrackPlugin,
  WiggleRendererPlugin,
  LollipopRendererPlugin,
]
