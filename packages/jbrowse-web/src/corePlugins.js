import MainMenuBarPlugin from './plugins/MainMenuBar'

// adapters
import BamAdapterPlugin from './plugins/BamAdapter'
import TwoBitAdapterPlugin from './plugins/TwoBitAdapter'
import IndexedFastaAdapterPlugin from './plugins/IndexedFastaAdapter'
import BigWigAdapterPlugin from './plugins/BigWigAdapter'
import FromConfigAdapterPlugin from './plugins/FromConfigAdapter'

// tracks
import AlignmentsTrackPlugin from './plugins/AlignmentsTrack'
import SequenceTrackPlugin from './plugins/SequenceTrack'
import FilteringTrackPlugin from './plugins/FilteringTrack'

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

export default [
  MainMenuBarPlugin,
  HierarchicalTrackSelectorDrawerWidgetPlugin,
  BamAdapterPlugin,
  TwoBitAdapterPlugin,
  IndexedFastaAdapterPlugin,
  BigWigAdapterPlugin,
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
  WiggleRendererPlugin,
]
