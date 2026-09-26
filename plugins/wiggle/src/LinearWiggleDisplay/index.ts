import { DisplayType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'

import configSchema from './configSchema.ts'
import { retiredState, retiredTypes } from './retired.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// `lazyWithPreload()`, not a static import: this module is reachable from the plugin entry,
// which every product's corePlugins imports at boot, and WiggleComponent reaches
// WIGGLE_MARKS → shaders/wiggle.generated.ts, i.e. ~20 KB of generated WGSL/GLSL
// source. A static import puts that in the always-loaded chunk (and on Canvas2D
// users, who never compile it). The dynamic import is the chunk boundary.
//
// One wrapper, exported: a plugin registering a display against this same body
// takes it, since a second `lazyWithPreload()` over the same import would be a
// distinct component type for React — remounting the subtree rather than
// reusing it if a display ever swapped between them.
export const ReactComponent = lazyWithPreload(
  () => import('./components/WiggleComponent.tsx'),
)

export default function LinearWiggleDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearWiggleDisplay',
        displayName: 'Wiggle display',
        configSchema,
        // lazily loaded, for the same reason the component below is: the model
        // reaches the wiggle mixins and the score-scale machinery, and is
        // needed only once a quantitative track is shown. gccontent composes
        // this factory from '@jbrowse/plugin-wiggle/LinearWiggleDisplay/
        // stateModel' — the subpath, so the barrel keeps no value edge to it.
        stateModel: () =>
          import('./model.ts').then(f =>
            f.default(pluginManager, configSchema),
          ),
        // The quantitative track types draw the same picture; they differ in
        // adapter shorthand, add-track workflow and, for GC content, the
        // adapter that computes the signal.
        trackType: [
          'QuantitativeTrack',
          'MultiQuantitativeTrack',
          'GCContentTrack',
        ],
        viewType: 'LinearGenomeView',
        ReactComponent,
        retiredTypes,
        retiredState,
      }),
  )
}

export { default as configSchema } from './configSchema.ts'
