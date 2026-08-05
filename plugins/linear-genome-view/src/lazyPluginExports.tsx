import { Suspense, lazy } from 'react'

import type { LinearGenomeViewModel } from './LinearGenomeView/index.ts'
import type { ComponentType } from 'react'

/**
 * The three React components `LinearGenomeViewPlugin.exports` publishes to
 * external plugins, each behind its own chunk.
 *
 * They used to be plain static imports in the plugin's `index.ts`, and that one
 * object was enough to undo the `lazy()` the view type is registered with:
 * `exports` is evaluated when the plugin class body is, so **every** host that
 * installs this plugin pulled in the whole stock LGV component tree — and
 * through it `@jbrowse/core/ui` and most of Material UI — before first paint,
 * including a host that renders none of JBrowse's own chrome. Measured on
 * `products/jbrowse-build-your-own`'s examples site, where no page renders a
 * single one of these: 63 chunks, 239 KB raw / 89 KB gzipped.
 *
 * That is the shape to watch for. A `lazy()` at the registration site only
 * holds if nothing else in an eagerly-evaluated module names the same component,
 * and a plugin's `exports` object is the easiest place to name one by accident.
 *
 * The `Suspense` wrapper is what keeps the change invisible to a consumer: a
 * bare `lazy()` component handed to a plugin that renders it outside a boundary
 * would throw where a static one worked, and external plugins are exactly the
 * consumers we cannot check (`reference/PLUGIN_ABI_STABILITY.md`). Same
 * treatment, and the same reason, as core's `ReExports/lazify.tsx` — which is
 * not reused here only because it is not on core's exports map.
 */
function suspend<P extends object>(
  displayName: string,
  Component: ComponentType<P>,
) {
  function Suspended(props: P) {
    return (
      <Suspense fallback={null}>
        <Component {...props} />
      </Suspense>
    )
  }
  Suspended.displayName = displayName
  return Suspended
}

export const LinearGenomeView = suspend<{ model: LinearGenomeViewModel }>(
  'LinearGenomeView',
  lazy(() => import('./LinearGenomeView/components/LinearGenomeView.tsx')),
)

export const SearchBox = suspend<{
  model: LinearGenomeViewModel
  showHelp?: boolean
  minWidth?: number
  maxWidth?: number
  style?: React.CSSProperties
}>(
  'SearchBox',
  lazy(() => import('./LinearGenomeView/components/SearchBox.tsx')),
)

export const ZoomControls = suspend<{ model: LinearGenomeViewModel }>(
  'ZoomControls',
  lazy(() => import('./LinearGenomeView/components/HeaderZoomControls.tsx')),
)
