import Plugin from '@jbrowse/core/Plugin'

import CramAdapterF from './BamAdapter/index.ts'
import BamAdapterF from './CramAdapter/index.ts'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes/index.ts'
import HtsgetBamAdapterF from './HtsgetBamAdapter/index.ts'
import PileupRPCMethodsF from './PileupRPC/index.ts'
import PileupRendererF from './PileupRenderer/index.ts'
import LinearReadArcsDisplayRPCMethodsF from './RenderLinearReadArcsDisplayRPC/index.ts'
import LinearReadCloudDisplayRPCMethodsF from './RenderLinearReadCloudDisplayRPC/index.ts'
import SNPCoverageAdapterF from './SNPCoverageAdapter/index.ts'
import SNPCoverageRendererF from './SNPCoverageRenderer/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Worker-only version of AlignmentsPlugin
 * Registers only adapters, renderers, and RPC methods needed in the worker
 * Excludes displays, tracks, widgets, and other UI-only code
 */
export default class AlignmentsWorkerPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    ;[
      CramAdapterF,
      BamAdapterF,
      SNPCoverageAdapterF,
      HtsgetBamAdapterF,
      PileupRendererF,
      PileupRPCMethodsF,
      LinearReadArcsDisplayRPCMethodsF,
      LinearReadCloudDisplayRPCMethodsF,
      SNPCoverageRendererF,
      GuessAlignmentsTypesF,
    ].map(f => {
      f(pluginManager)
    })
  }
}
