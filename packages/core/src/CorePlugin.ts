import { trackTypeForAdapter } from '@jbrowse/add-track-core'

import { configSchema, stateModelFactory } from './BaseFeatureWidget/index.ts'
import Plugin from './Plugin.ts'
import CytobandAdapterF from './data_adapters/CytobandAdapter/index.ts'
import WidgetType from './pluggableElementTypes/WidgetType.ts'
import * as coreRpcMethods from './rpc/coreRpcMethods.ts'
import { guessTrackConfFromTable } from './util/formatGuessers.ts'
import { getFileName } from './util/getFileName.ts'
import { lazyWithPreload } from './util/lazyWithPreload.ts'
import { addAdapterGuesser, addTrackTypeGuesser } from './util/tracks.ts'

import type PluginManager from './PluginManager.ts'

/**
 * Guess every format `@jbrowse/add-track-core`'s table describes — the same
 * table `@jbrowse/cli`'s `add-track` reads, so a file resolves to the same
 * adapter config in the app and on the command line.
 *
 * Whether a build can open a format is decided by `hasAdapterType`, not by the
 * table: guessing `BamAdapter` in a build with no alignments plugin writes a
 * track config that fails at render. A plugin therefore registers its adapters
 * and nothing else — there is no format list to keep in step. ADR-077.
 *
 * `CorePlugin` installs this first, so any `addAdapterGuesser` a plugin
 * registers is later in the chain and wins over the table. That is how a format
 * the table cannot express is added, and how a third-party plugin claims one.
 */
// #region installFormatGuessers
function installFormatGuessers(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const adapter = guessTrackConfFromTable(file, index, adapterHint)?.adapter
    return adapter && pluginManager.hasAdapterType(adapter.type)
      ? adapter
      : undefined
  })
  addTrackTypeGuesser(pluginManager, (adapterName, file) =>
    pluginManager.hasAdapterType(adapterName)
      ? trackTypeForAdapter(adapterName, file && getFileName(file))
      : undefined,
  )
}
// #endregion

// the core plugin, which registers types that ALL JBrowse applications are
// expected to need.
export default class CorePlugin extends Plugin {
  name = 'CorePlugin'

  install(pluginManager: PluginManager) {
    // register all our core rpc methods
    for (const RpcMethod of Object.values(coreRpcMethods)) {
      pluginManager.addRpcMethod(() => new RpcMethod(pluginManager))
    }

    CytobandAdapterF(pluginManager)
    installFormatGuessers(pluginManager)

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'BaseFeatureWidget',
        discardOnClose: true,
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazyWithPreload(
          () => import('./BaseFeatureWidget/BaseFeatureDetail/index.tsx'),
        ),
      })
    })
  }
}
