import { BaseWebSession } from '@jbrowse/web-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  SessionWithConfigEditing,
  SessionWithConnectionEditing,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

export default function sessionModelFactory({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return BaseWebSession({ pluginManager, assemblyConfigSchema })
}

export type WebSessionModelType = ReturnType<typeof sessionModelFactory>
export type WebSessionModel = Instance<WebSessionModelType>

// the capability contracts this embedded app relies on — see AssertSessionModel
// for why each one is asserted separately
export type _AssertSessionModel = AssertSessionModel<WebSessionModel>
export type _AssertFocusedView = AssertExtends<
  WebSessionModel,
  SessionWithFocusedViewAndDrawerWidgets
>
export type _AssertConnectionEditing = AssertExtends<
  WebSessionModel,
  SessionWithConnectionEditing
>
export type _AssertConfigEditing = AssertExtends<
  WebSessionModel,
  SessionWithConfigEditing
>
