import { AppWidgetsPlugin } from '@jbrowse/app-core'
import Alignments from '@jbrowse/plugin-alignments'
import Authentication from '@jbrowse/plugin-authentication'
import Bed from '@jbrowse/plugin-bed'
import Blat from '@jbrowse/plugin-blat'
import BreakpointSplitView from '@jbrowse/plugin-breakpoint-split-view'
import Canvas from '@jbrowse/plugin-canvas'
import CircularView from '@jbrowse/plugin-circular-view'
import ComparativeAdapters from '@jbrowse/plugin-comparative-adapters'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import DotplotView from '@jbrowse/plugin-dotplot-view'
import GCContent from '@jbrowse/plugin-gccontent'
import Gff3 from '@jbrowse/plugin-gff3'
import GtfPlugin from '@jbrowse/plugin-gtf'
import Gwas from '@jbrowse/plugin-gwas'
import HicPlugin from '@jbrowse/plugin-hic'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearComparativeView from '@jbrowse/plugin-linear-comparative-view'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import Maf from '@jbrowse/plugin-maf'
import Marks from '@jbrowse/plugin-marks'
import RDF from '@jbrowse/plugin-rdf'
import Sequence from '@jbrowse/plugin-sequence'
import SpreadsheetViewPlugin from '@jbrowse/plugin-spreadsheet-view'
import SvInspectorPlugin from '@jbrowse/plugin-sv-inspector'
import TrixPlugin from '@jbrowse/plugin-trix'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'

import TextIndex from './TextIndexing/index.ts'

const corePlugins = [
  Canvas,
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
  LegacyJBrowse,
  LinearComparativeView,
  AppWidgetsPlugin,
  RDF,
  Sequence,
  TextIndex,
  Variants,
  Wiggle,
  GCContent,
  Maf,
  SpreadsheetViewPlugin,
  SvInspectorPlugin,
  BreakpointSplitView,
  HicPlugin,
  TrixPlugin,
  ComparativeAdapters,
  Gwas,
  Marks,
  Blat,
]

export default corePlugins
