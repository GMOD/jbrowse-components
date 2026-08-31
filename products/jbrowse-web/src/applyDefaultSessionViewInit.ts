import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// `view.type` is the discriminant; the LinearGenomeView model owns setLaunch,
// `pendingLaunch` and assemblyNames, none of which are on the base view interface
interface LinearGenomeViewLike {
  type: string
  assemblyNames: string[]
  pendingLaunch?: InitState
  setLaunch: (launch: InitState) => void
}

// The alias-aware half of the session the assembly comparison below needs.
interface SessionLike {
  views: { type: string }[]
  assemblyManager?: {
    getCanonicalAssemblyName: (asmName: string) => string | undefined
  }
}

// Layers URL params onto the defaultSession's first LinearGenomeView via its
// existing init autorun (which waits for the assembly and navigates), instead
// of replacing the session.
export function applyDefaultSessionViewInit(
  session: SessionLike | undefined,
  // the URL-param subset of InitState (assembly relaxed to optional — it falls
  // back below). Derived from InitState so it can't drift.
  init: Partial<InitState>,
) {
  const view = session?.views.find(v => v.type === 'LinearGenomeView') as
    | LinearGenomeViewLike
    | undefined
  // The URL may omit assembly. A defaultSession view launched from a locstring
  // hasn't navigated yet, so assemblyNames (derived from displayedRegions) is
  // still empty and only its pending launch names one.
  const pending = view?.pendingLaunch
  const assembly = init.assembly ?? pending?.assembly ?? view?.assemblyNames[0]
  if (session && view && assembly) {
    // extendSession means "add to the defaultSession", so the URL's keys layer
    // over the view's own pending launch rather than replacing it — a config
    // that opened tracks via `tracks` keeps them when the URL only sets `loc`.
    // buildLgvInit omits the params the URL didn't carry, so no key here is
    // present-but-undefined, which would erase its counterpart.
    //
    // Unless the URL switches assemblies: the pending launch's tracks and loc
    // belong to the old one, and carrying them over opens tracks whose adapters
    // resolve no refNames — an empty track, not an error.
    //
    // Through the assembly manager, so the two names are compared the way the
    // rest of the subsystem compares them: `hg38` in the URL beside `GRCh38` in
    // the config is one assembly, and a raw `===` read it as a switch and threw
    // the defaultSession's tracks away without a diagnostic.
    const base = sameAssembly(session, pending?.assembly, assembly)
      ? pending
      : undefined
    view.setLaunch({ ...base, ...init, assembly })
  }
}

// Undefined either side is not a match: an absent pending assembly has nothing
// to carry over. An unrecognized name resolves to undefined, so it falls back to
// comparing the names as written rather than matching everything unknown.
function sameAssembly(session: SessionLike, a: string | undefined, b: string) {
  if (a === undefined) {
    return false
  }
  const am = session.assemblyManager
  return (
    (am?.getCanonicalAssemblyName(a) ?? a) ===
    (am?.getCanonicalAssemblyName(b) ?? b)
  )
}
