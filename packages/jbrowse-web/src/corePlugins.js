import JBrowse1 from '@gmod/jbrowse-plugin-jbrowse1'
import DataManagement from '@gmod/jbrowse-plugin-data-management'
import Config from '@gmod/jbrowse-plugin-config'
import TrackHubRegistry from '@gmod/jbrowse-plugin-trackhub-registry'
import LinearGenomeView from '@gmod/jbrowse-plugin-linear-genome-view'
import Alignments from '@gmod/jbrowse-plugin-alignments'
import Sequence from '@gmod/jbrowse-plugin-sequence'
import Bed from '@gmod/jbrowse-plugin-bed'
import Variants from '@gmod/jbrowse-plugin-variants'
import Wiggle from '@gmod/jbrowse-plugin-wiggle'
import Lollipop from '@gmod/jbrowse-plugin-lollipop'
import SVG from '@gmod/jbrowse-plugin-svg'
import Filtering from '@gmod/jbrowse-plugin-filtering'

import MainMenuBarPlugin from './plugins/MainMenuBar'

export default [
  Alignments,
  Sequence,
  DataManagement,
  Config,
  MainMenuBarPlugin,
  Variants,
  Bed,
  LinearGenomeView,
  SVG,
  Filtering,
  Lollipop,
  JBrowse1,
  TrackHubRegistry,
  Wiggle,
]
