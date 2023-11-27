import Alignments from '@jbrowse/plugin-alignments'
import Authentication from '@jbrowse/plugin-authentication'
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
import Arc from '@jbrowse/plugin-arc'

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
