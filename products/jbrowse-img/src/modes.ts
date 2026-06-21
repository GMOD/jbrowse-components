// Every render mode jbrowse-img supports and how each is dispatched. This is the
// single source of truth that the CLI subcommands + help (options.ts), the
// --spec view-type mapping, and the renderer dispatch (renderRegion.tsx) all
// derive from. `linear` is the implicit default (bare invocation with no
// subcommand) but is registered here so `jb2export lgv ...` also works and so
// the renderer Record stays exhaustive.

export type ViewMode = 'linear' | 'dotplot' | 'synteny' | 'circular'

export interface ModeDescriptor {
  // The CLI subcommand token a user types to select this mode. `linear` uses
  // `lgv` (LinearGenomeView) rather than its internal mode name.
  subcommand: string
  // MST view type, also the session-spec `type` discriminator. Absent for
  // linear, which is never selected via --spec.
  viewType?: string
  // Renders two or more assemblies: accepts --fasta2/--loc2, the comparison
  // track types, and the second-assembly help section.
  comparative: boolean
}

export const modeDescriptors: Record<ViewMode, ModeDescriptor> = {
  linear: { subcommand: 'lgv', comparative: false },
  dotplot: { subcommand: 'dotplot', viewType: 'DotplotView', comparative: true },
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
