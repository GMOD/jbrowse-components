import { Suspense, lazy } from 'react'

import type { LinearGenomeViewModel } from './model.ts'
import type { ComponentType } from 'react'

/**
 * The two React components the view model hands out, `HeaderComponent` and
 * `MiniControlsComponent`, behind their own chunks.
 *
 * The model used to `import Header from './components/Header.tsx'` at the top
 * of `model.ts`, and that one line was the single most expensive static edge in
 * the whole app's first paint. A view's state model is unavoidably eager — it
 * is registered when the plugin installs, before any session snapshot loads —
 * so the edge dragged the entire stock header in with it: `SearchBox` →
 * `RefNameAutocomplete` → MUI `Autocomplete`, `HeaderZoomControls` →
 * `SingleSlider` → MUI `Slider`, and the rest of `@jbrowse/core/ui` behind
 * them. Every host paid it, including one that sets `hideHeader` and never
 * renders a pixel of it.
 *
 * Cutting it as a *removal* — deleting the two methods and importing straight
 * into `LinearGenomeViewContainer`, the way `DisplayMessageComponent` went —
 * would work too and save the chunk boundary, but these are documented `#method`
 * entries on the view model and an external plugin may override one to supply
 * its own header. `lazy()` buys the same bytes without that bet
 * (`reference/PLUGIN_ABI_STABILITY.md`). The chunks are dynamic children of a
 * subtree that is already lazy, so Vite preloads them alongside it rather than
 * in a second round trip.
 *
 * `Suspense` here rather than at the call site: the caller receives a component
 * and renders it, and a bare `lazy()` would make that throw where a static
 * import did not.
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

export const Header = suspend<{ model: LinearGenomeViewModel }>(
  'Header',
  lazy(() => import('./components/Header.tsx')),
)

export const MiniControls = suspend<{ model: LinearGenomeViewModel }>(
  'MiniControls',
  lazy(() => import('./components/MiniControls.tsx')),
)
