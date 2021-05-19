import Alignments from '@jbrowse/plugin-alignments'
import Bed from '@jbrowse/plugin-bed'
import BreakpointSplitView from '@jbrowse/plugin-breakpoint-split-view'
import CircularView from '@jbrowse/plugin-circular-view'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import DotplotView from '@jbrowse/plugin-dotplot-view'
import Filtering from '@jbrowse/plugin-filtering'
import Gff3Tabix from '@jbrowse/plugin-gff3'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import LinearComparativeView from '@jbrowse/plugin-linear-comparative-view'
import Lollipop from '@jbrowse/plugin-lollipop'
import Menus from '@jbrowse/plugin-menus'
import RDF from '@jbrowse/plugin-rdf'
import Sequence from '@jbrowse/plugin-sequence'
import SVG from '@jbrowse/plugin-svg'
import TrackHubRegistry from '@jbrowse/plugin-trackhub-registry'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'
import SpreadsheetViewPlugin from '@jbrowse/plugin-spreadsheet-view'
import SvInspectorPlugin from '@jbrowse/plugin-sv-inspector'
import HicPlugin from '@jbrowse/plugin-hic'

const corePlugins = [
  SVG,
  LinearGenomeView,
  Alignments,
  Bed,
  CircularView,
  Config,
  DataManagement,
  DotplotView,
  Filtering,
  Gff3Tabix,
  LegacyJBrowse,
  LinearComparativeView,
  Lollipop,
  Menus,
  RDF,
  Sequence,
  TrackHubRegistry,
  Variants,
  Wiggle,
  SpreadsheetViewPlugin,
  SvInspectorPlugin,
  BreakpointSplitView,
  HicPlugin,
]

export default corePlugins
