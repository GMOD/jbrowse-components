import Alignments from '@jbrowse/plugin-alignments'
import BED from '@jbrowse/plugin-bed'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import GFF3 from '@jbrowse/plugin-gff3'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import Sequence from '@jbrowse/plugin-sequence'
import SVG from '@jbrowse/plugin-svg'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'
import GCContent from '@jbrowse/plugin-gccontent'
import Trix from '@jbrowse/plugin-trix'

const corePlugins = [
  SVG,
  Alignments,
  BED,
  Config,
  DataManagement,
  GFF3,
  LegacyJBrowse,
  LinearGenomeView,
  Sequence,
  Variants,
  Wiggle,
  GCContent,
  Trix,
]

export default corePlugins
