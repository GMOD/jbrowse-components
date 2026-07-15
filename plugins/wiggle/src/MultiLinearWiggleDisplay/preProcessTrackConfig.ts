import { addDisplayConfigMigration } from '@jbrowse/core/pluggableElementTypes/models'

import { remapMultiWiggleRendering } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// MultiLinearWiggleDisplay's legacy single-source `defaultRendering` remap
// (e.g. "xyplot" -> "multixyplot") rewrites the value of a constrained enum
// slot, so it must run before the display types.union validates the snapshot —
// the config-schema preProcessSnapshot alone does not (see
// addDisplayConfigMigration).
export default function MigrateMultiWiggleConfigF(
  pluginManager: PluginManager,
) {
  addDisplayConfigMigration(
    pluginManager,
    ['MultiLinearWiggleDisplay'],
    remapMultiWiggleRendering,
  )
}
