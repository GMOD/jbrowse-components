import MarkClusterRows from './MarkClusterRows.ts'
import MarkGetRowMatrix from './MarkGetRowMatrix.ts'
import MarkGetRowSources from './MarkGetRowSources.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MarkRowsRPCF(pm: PluginManager) {
  pm.addRpcMethod(() => new MarkClusterRows(pm))
  pm.addRpcMethod(() => new MarkGetRowMatrix(pm))
  pm.addRpcMethod(() => new MarkGetRowSources(pm))
}
