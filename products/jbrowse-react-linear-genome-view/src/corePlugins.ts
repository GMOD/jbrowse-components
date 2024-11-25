import Alignments from '@jbrowse/plugin-alignments'
import Arc from '@jbrowse/plugin-arc'
import Authentication from '@jbrowse/plugin-authentication'
import BED from '@jbrowse/plugin-bed'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import GCContent from '@jbrowse/plugin-gccontent'
import GFF3 from '@jbrowse/plugin-gff3'
import LegacyJBrowse from '@jbrowse/plugin-legacy-jbrowse'
import LinearGenomeView from '@jbrowse/plugin-linear-genome-view'
import Sequence from '@jbrowse/plugin-sequence'
import SVG from '@jbrowse/plugin-svg'
import Trix from '@jbrowse/plugin-trix'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'

const corePlugins = [
  SVG,
  Alignments,
  Authentication,
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
  Arc,
]

export default corePlugins
