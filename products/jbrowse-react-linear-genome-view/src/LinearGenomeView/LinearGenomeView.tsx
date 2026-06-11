import { useEffect, useState } from 'react'

import { observer } from 'mobx-react'

import createViewState from '../createViewState.ts'
import JBrowseLinearGenomeView from '../JBrowseLinearGenomeView/index.ts'

import type { ViewStateOptions } from '../createViewState.ts'
import type { ViewModel } from '../createModel/createModel.ts'
import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// `init.assembly` is auto-filled from the top-level `assembly.name`, so callers
// describe only what to show
type InitInput = Omit<InitState, 'assembly'> & { assembly?: string }

export interface LinearGenomeViewProps
  extends Omit<ViewStateOptions, 'assembly' | 'location' | 'highlight'> {
  // the managed wrapper resolves `init.assembly` from this name, so unlike the
  // raw createViewState option it must carry a definite `name`
  assembly: ViewStateOptions['assembly'] & { name: string }

  // declarative description of what to show initially: { loc, tracks,
  // highlight, tracklist, nav, ... }. mirrors the view's stored `init` shape,
  // so the same blob round-trips through sessions and URL specs
  init?: InitInput

  // receives the live MST engine once, for imperative escapes (navToLocString,
  // showTrack, onPatch, ...) that the declarative props don't cover
  onStateReady?: (state: ViewModel) => void
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseLinearGenomeView}. Props are initial values (like an input's
 * `defaultValue`): the engine is constructed once and later prop changes are
 * ignored. To swap assembly/plugins, remount via React `key`. For ongoing
 * imperative control, grab the engine through `onStateReady`.
 */
const LinearGenomeView = observer(function LinearGenomeView(
  props: LinearGenomeViewProps,
) {
  const { assembly, init, defaultSession, onStateReady, ...rest } = props

  const [state] = useState(() =>
    createViewState({
      ...rest,
      assembly,
      // a caller-supplied defaultSession wins verbatim; otherwise build one
      // around `init`. when neither is given, fall back to createViewState's
      // no-init default (the import form)
      defaultSession:
        defaultSession ??
        (init
          ? {
              name: 'this session',
              view: {
                type: 'LinearGenomeView',
                init: { assembly: assembly.name, ...init },
              },
            }
          : undefined),
    }),
  )

  useEffect(() => {
    onStateReady?.(state)
  }, [state, onStateReady])

  return <JBrowseLinearGenomeView viewState={state} />
})

export default LinearGenomeView
