import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// `view.type` is the discriminant; the LinearGenomeView model owns setInit,
// `init` and assemblyNames, none of which are on the base view interface
interface LinearGenomeViewLike {
  type: string
  assemblyNames: string[]
  init?: InitState
  setInit: (init: InitState) => void
}

// Layers URL params onto the defaultSession's first LinearGenomeView via its
// existing init autorun (which waits for the assembly and navigates), instead
// of replacing the session.
export function applyDefaultSessionViewInit(
  session: { views: { type: string }[] } | undefined,
  // the URL-param subset of InitState (assembly relaxed to optional — it falls
  // back below). Derived from InitState so it can't drift.
  init: Partial<InitState>,
) {
  const view = session?.views.find(v => v.type === 'LinearGenomeView') as
    | LinearGenomeViewLike
    | undefined
  // The URL may omit assembly. A defaultSession view that used the `init`
  // shorthand hasn't navigated yet, so assemblyNames (derived from
  // displayedRegions) is still empty and only its pending init names one.
  const pending = view?.init
  const assembly = init.assembly ?? pending?.assembly ?? view?.assemblyNames[0]
  if (view && assembly) {
    // extendSession means "add to the defaultSession", so the URL's keys layer
    // over the view's own pending init rather than replacing it — a config that
    // opened tracks via `init.tracks` keeps them when the URL only sets `loc`.
    // buildLgvInit omits the params the URL didn't carry, so no key here is
    // present-but-undefined, which would erase its counterpart.
    //
    // Unless the URL switches assemblies: the pending init's tracks and loc
    // belong to the old one, and carrying them over opens tracks whose adapters
    // resolve no refNames — an empty track, not an error.
    const base = pending?.assembly === assembly ? pending : undefined
    view.setInit({ ...base, ...init, assembly })
  }
}
