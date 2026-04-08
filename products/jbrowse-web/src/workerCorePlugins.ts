import AlignmentsWorker from '@jbrowse/plugin-alignments/src/index.worker.ts'
import Arc from '@jbrowse/plugin-arc'
import Bed from '@jbrowse/plugin-bed'
import BreakpointSplitView from '@jbrowse/plugin-breakpoint-split-view'
import Canvas from '@jbrowse/plugin-canvas'
import ComparativeAdapters from '@jbrowse/plugin-comparative-adapters'
import Config from '@jbrowse/plugin-config'
import DotplotView from '@jbrowse/plugin-dotplot-view'
import GCContent from '@jbrowse/plugin-gccontent'
import Gff3 from '@jbrowse/plugin-gff3'
import GtfPlugin from '@jbrowse/plugin-gtf'
import HicPlugin from '@jbrowse/plugin-hic'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import Lollipop from '@jbrowse/plugin-lollipop'
import RDF from '@jbrowse/plugin-rdf'
import Sequence from '@jbrowse/plugin-sequence'
import TrixPlugin from '@jbrowse/plugin-trix'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'

// Pure-UI plugins excluded from worker:
// Authentication, CircularView, DataManagement, GridBookmark,
// JobsManagement, LinearComparativeView, LinearGenomeView,
// Menus, SpreadsheetView, SvInspector

const workerCorePlugins = [
  Canvas,
  AlignmentsWorker,
  Bed,
  Config,
  DotplotView,
  GtfPlugin,
  Gff3,
  LegacyJBrowse,
  Lollipop,
  RDF,
  Sequence,
  Variants,
  Wiggle,
  GCContent,
  BreakpointSplitView,
  HicPlugin,
  TrixPlugin,
  ComparativeAdapters,
  Arc,
]

export default workerCorePlugins
