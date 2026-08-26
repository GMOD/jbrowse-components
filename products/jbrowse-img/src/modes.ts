// Every render mode jbrowse-img supports and how each is dispatched. This is the
// single source of truth that the CLI subcommands + help (options.ts), the
// --spec view-type mapping, and the renderer dispatch (renderRegion.ts) all
// derive from. `linear` is the implicit default (bare invocation with no
// subcommand) but is registered here so `jb2export lgv ...` also works and so
// the renderer Record stays exhaustive.

export type ViewMode =
  | 'linear'
  | 'dotplot'
  | 'synteny'
  | 'circular'
  | 'breakpoint'

export interface ModeDescriptor {
  // The CLI subcommand token a user types to select this mode. `linear` uses
  // `lgv` (LinearGenomeView) rather than its internal mode name.
  subcommand: string
  // MST view type, also the session-spec `type` discriminator.
  viewType?: string
  // Renders two or more assemblies: accepts --fasta2/--loc2, the comparison
  // track types, and the second-assembly help section.
  comparative: boolean
}

export const modeDescriptors: Record<ViewMode, ModeDescriptor> = {
  // The LGV takes a --spec too. Its session-spec view object is already the
  // shape of the LGV's own `init` prop (assembly / loc / tracks / highlight, see
  // LinearGenomeView InitState), so a `&session=spec-` copied out of a jbrowse
  // URL renders here unchanged — which is how the website's R-export figures
  // reproduce the exact session their browser counterparts show.
  linear: {
    subcommand: 'lgv',
    viewType: 'LinearGenomeView',
    comparative: false,
  },
  dotplot: {
    subcommand: 'dotplot',
    viewType: 'DotplotView',
    comparative: true,
  },
  synteny: {
    subcommand: 'synteny',
    viewType: 'LinearSyntenyView',
    comparative: true,
  },
  circular: {
    subcommand: 'circular',
    viewType: 'CircularView',
    comparative: false,
  },
  // One assembly, several windows of it stacked with the reads that leave one
  // and arrive in another drawn between them — so `comparative: false` even
  // though it renders more than one panel. `comparative` asks whether a mode
  // takes a SECOND ASSEMBLY (--fasta2, comparison tracks), which this does not.
  breakpoint: {
    subcommand: 'breakpoint',
    viewType: 'BreakpointSplitView',
    comparative: false,
  },
}

export const viewModes = Object.keys(modeDescriptors) as ViewMode[]

// CLI subcommand token -> mode, e.g. `lgv` -> `linear`, `dotplot` -> `dotplot`.
const subcommandToMode = new Map(
  viewModes.map(mode => [modeDescriptors[mode].subcommand, mode]),
)

export function subcommandMode(token: string) {
  return subcommandToMode.get(token)
}

export const subcommandTokens = viewModes.map(
  mode => modeDescriptors[mode].subcommand,
)

// Inverse of modeDescriptors[mode].viewType: MST view type -> mode. Used by
// --spec to pick its renderer, and to point a user at the right subcommand when
// a --session carries a view the mode they asked for can't draw.
export const viewTypeModes = new Map(
  viewModes.flatMap(mode => {
    const { viewType } = modeDescriptors[mode]
    return viewType ? ([[viewType, mode]] as const) : []
  }),
)

export function subcommandForViewType(viewType: string) {
  const mode = viewTypeModes.get(viewType)
  return mode && modeDescriptors[mode].subcommand
}
