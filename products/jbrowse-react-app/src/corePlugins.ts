import Alignments from '@jbrowse/plugin-alignments'
import Arc from '@jbrowse/plugin-arc'
import Authentication from '@jbrowse/plugin-authentication'
import Bed from '@jbrowse/plugin-bed'
import BreakpointSplitView from '@jbrowse/plugin-breakpoint-split-view'
import CircularView from '@jbrowse/plugin-circular-view'
import ComparativeAdapters from '@jbrowse/plugin-comparative-adapters'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import DotplotView from '@jbrowse/plugin-dotplot-view'
import GCContent from '@jbrowse/plugin-gccontent'
import Gff3 from '@jbrowse/plugin-gff3'
import GridBookmarkPlugin from '@jbrowse/plugin-grid-bookmark'
import GtfPlugin from '@jbrowse/plugin-gtf'
import HicPlugin from '@jbrowse/plugin-hic'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearComparativeView from '@jbrowse/plugin-linear-comparative-view'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import Lollipop from '@jbrowse/plugin-lollipop'
import Menus from '@jbrowse/plugin-menus'
import RDF from '@jbrowse/plugin-rdf'
import Sequence from '@jbrowse/plugin-sequence'
import SpreadsheetViewPlugin from '@jbrowse/plugin-spreadsheet-view'
import SvInspectorPlugin from '@jbrowse/plugin-sv-inspector'
import SVG from '@jbrowse/plugin-svg'
import TrixPlugin from '@jbrowse/plugin-trix'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'

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
  GtfPlugin,
  Gff3,
  LegacyJBrowse,
  LinearComparativeView,
  Lollipop,
  Menus,
  RDF,
  Sequence,
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
  Arc,
]

export default corePlugins
