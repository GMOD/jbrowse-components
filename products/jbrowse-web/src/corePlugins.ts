import Alignments from '@jbrowse/plugin-alignments'
import Authentication from '@jbrowse/plugin-authentication'
import Bed from '@jbrowse/plugin-bed'
import BreakpointSplitView from '@jbrowse/plugin-breakpoint-split-view'
import CircularView from '@jbrowse/plugin-circular-view'
import Config from '@jbrowse/plugin-config'
import ComparativeAdapters from '@jbrowse/plugin-comparative-adapters'
import DataManagement from '@jbrowse/plugin-data-management'
import DotplotView from '@jbrowse/plugin-dotplot-view'
import GtfPlugin from '@jbrowse/plugin-gtf'
import Gff3 from '@jbrowse/plugin-gff3'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import LinearComparativeView from '@jbrowse/plugin-linear-comparative-view'
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
  GtfPlugin,
  Gff3,
  LegacyJBrowse,
  LinearComparativeView,
  Lollipop,
  Arc,
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
]

export default corePlugins
