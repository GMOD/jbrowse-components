import Alignments from '@jbrowse/plugin-alignments'
import Authentication from '@jbrowse/plugin-authentication'
import Bed from '@jbrowse/plugin-bed'
import BreakpointSplitView from '@jbrowse/plugin-breakpoint-split-view'
import CircularView from '@jbrowse/plugin-circular-view'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import DotplotView from '@jbrowse/plugin-dotplot-view'
import Gff3 from '@jbrowse/plugin-gff3'
import GtfPlugin from '@jbrowse/plugin-gtf'
import JobsManagementPlugin from '@jbrowse/plugin-jobs-management'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import LinearComparativeView from '@jbrowse/plugin-linear-comparative-view'
import ComparativeAdapters from '@jbrowse/plugin-comparative-adapters'
import Lollipop from '@jbrowse/plugin-lollipop'
import Arc from '@jbrowse/plugin-arc'
import Menus from '@jbrowse/plugin-menus'
import RDF from '@jbrowse/plugin-rdf'
import Sequence from '@jbrowse/plugin-sequence'
import SVG from '@jbrowse/plugin-svg'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'
import GCContent from '@jbrowse/plugin-gccontent'
import SpreadsheetViewPlugin from '@jbrowse/plugin-spreadsheet-view'
import SvInspectorPlugin from '@jbrowse/plugin-sv-inspector'
import HicPlugin from '@jbrowse/plugin-hic'
import TextIndex from '@jbrowse/plugin-text-indexing'
import TrixPlugin from '@jbrowse/plugin-trix'
import GridBookmarkPlugin from '@jbrowse/plugin-grid-bookmark'

const corePlugins = [
  SVG,
  LinearGenomeView,
  Alignments,
  Authentication,
  Bed,
  CircularView,
  Config,
  DataManagement,
  DotplotView,
  Gff3,
  GtfPlugin,
  JobsManagementPlugin,
  LegacyJBrowse,
  LinearComparativeView,
  Lollipop,
  Arc,
  Menus,
  RDF,
  Sequence,
  TextIndex,
  Variants,
  Wiggle,
  GCContent,
  SpreadsheetViewPlugin,
  SvInspectorPlugin,
  BreakpointSplitView,
  HicPlugin,
  TrixPlugin,
  GridBookmarkPlugin,
  ComparativeAdapters,
]

export default corePlugins
