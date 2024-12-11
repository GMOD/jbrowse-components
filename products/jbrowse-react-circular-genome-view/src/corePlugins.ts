import Authentication from '@jbrowse/plugin-authentication'
import CircularGenomeView from '@jbrowse/plugin-circular-view'
import Config from '@jbrowse/plugin-config'
import DataManagement from '@jbrowse/plugin-data-management'
import Sequence from '@jbrowse/plugin-sequence'
import Variants from '@jbrowse/plugin-variants'
import Wiggle from '@jbrowse/plugin-wiggle'

const corePlugins = [
  Authentication,
  Config,
  DataManagement,
  CircularGenomeView,
  Sequence,
  Variants,
  Wiggle,
]

export default corePlugins
