import type { InitState } from '@jbrowse/plugin-linear-genome-view'

// `view.type` is the discriminant; the LinearGenomeView model owns setInit and
// assemblyNames, neither of which is on the base view interface
interface LinearGenomeViewLike {
  type: string
  assemblyNames: string[]
  setInit: (init: InitState) => void
}

// Layers URL params onto the defaultSession's first LinearGenomeView via its
// existing init autorun (which waits for the assembly and navigates), instead
// of replacing the session. The URL may omit assembly: the view's own is used.
export function applyDefaultSessionViewInit(
  session: { views: { type: string }[] } | undefined,
  init: {
    loc?: string
    assembly?: string
    tracks?: string[]
    tracklist?: boolean
    nav?: boolean
    highlight?: string[]
  },
) {
  const view = session?.views.find(v => v.type === 'LinearGenomeView') as
    LinearGenomeViewLike | undefined
  const assembly = init.assembly ?? view?.assemblyNames[0]
  if (view && assembly) {
    view.setInit({ ...init, assembly })
  }
}
