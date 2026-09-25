import Authentication from '@jbrowse/plugin-authentication'
import CircularGenomeView from '@jbrowse/plugin-circular-view'
import ComparativeAdapters from '@jbrowse/plugin-comparative-adapters'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import Marks from '@jbrowse/plugin-marks'
import Sequence from '@jbrowse/plugin-sequence'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'

const corePlugins = [
  Authentication,
  Config,
  DataManagement,
  CircularGenomeView,
  // the SyntenyTrack type ChordSyntenyDisplay attaches to, and the pairwise
  // adapters that feed a ribbon
  ComparativeAdapters,
  Sequence,
  Variants,
  // a quantitative track draws on the circle as a ring (ADR-119)
  Wiggle,
  Marks,
]

export default corePlugins
