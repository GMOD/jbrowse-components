import { getParent, types } from '@jbrowse/mobx-state-tree'
import {
  BaseSessionModel,
  ConnectionManagementSessionMixin,
  DrawerWidgetSessionMixin,
  ReferenceManagementSessionMixin,
  TrackMenuSessionMixin,
} from '@jbrowse/product-core'

import { EmbeddedSessionThemeMixin } from './EmbeddedSessionThemeMixin.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AssemblyManager } from '@jbrowse/core/util/types'

// This session lives at rootModel.session, so its MST parent is the root model;
// this is the slice it reaches for. A typed contract in place of getParent<any>,
// mirroring product-core's ConfigModelParent and web-core's AbstractWebRootModel.
// Each product pins its own root against this — getParent<T> is an unchecked
// assertion, so only that pin catches the shape drifting from the real root.
export interface EmbeddedSessionParent {
  version: string
  assemblyManager: AssemblyManager
  config: {
    assemblyName: string
  }
}

/**
 * #stateModel EmbeddedSessionMixin
 * Everything the two single-view embedded products' sessions
 * (react-linear-genome-view, react-circular-genome-view) share: the mixin set
 * they compose and the three getters that read the root model. The twin of
 * {@link createEmbeddedRootModel} one level down.
 *
 * A mixin the product composes, deliberately, rather than a factory taking the
 * product's view type and tracks mixin as parameters. That factory is the
 * obvious shape and it does not work: `types.compose`'s overloads are declared
 * over `IModelType<P, O, FC, FS>`, so a model handed in as a naked type
 * parameter has nothing to infer those four from and the composed result
 * degrades — `session.view` becomes `any`, which typechecks at every embedder
 * call site and is caught by nothing. Keeping every argument to `compose`
 * concrete is what keeps the products' views typed.
 *
 * So each product still spells out its own tracks mixin, `view` prop, and the
 * `views`/`addView`/`removeView` members that read `self.view` — those are the
 * ones that need its concrete view type.
 */
export function EmbeddedSessionMixin(pluginManager: PluginManager) {
  return types
    .compose(
      BaseSessionModel(pluginManager),
      DrawerWidgetSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      // ReferenceManagementSessionMixin and either tracks mixin share no
      // members, so their order relative to each other is not load-bearing
      ReferenceManagementSessionMixin(pluginManager),
      TrackMenuSessionMixin(pluginManager),
      EmbeddedSessionThemeMixin(pluginManager),
    )
    .views(self => ({
      /**
       * #getter
       */
      get version() {
        return getParent<EmbeddedSessionParent>(self).version
      },
      /**
       * #getter
       */
      // `assemblies` and `connections` are intentionally omitted:
      // BaseSessionModel and ConnectionManagementSessionMixin already resolve
      // them through `self.jbrowse` (= root.config), so re-declaring here would
      // just duplicate the base getters with looser types
      get assemblyNames() {
        return [getParent<EmbeddedSessionParent>(self).config.assemblyName]
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return getParent<EmbeddedSessionParent>(self).assemblyManager
      },
    }))
}
