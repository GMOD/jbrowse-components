// Every render mode jbrowse-img supports and how each is dispatched. This is the
// single source of truth that the CLI subcommands + help (options.ts), the
// --spec view-type mapping, and the renderer dispatch (renderRegion.tsx) all
// derive from. `linear` is the implicit default (bare invocation with no
// subcommand) but is registered here so `jb2export linear ...` also works and
// so the renderer Record stays exhaustive.

export type ViewMode = 'linear' | 'dotplot' | 'synteny' | 'circular'

export interface ModeDescriptor {
  // MST view type, also the session-spec `type` discriminator. Absent for
  // linear, which is never selected via --spec.
  viewType?: string
  // Renders two or more assemblies: accepts --fasta2/--loc2, the comparison
  // track types, and the second-assembly help section.
  comparative: boolean
}

export const modeDescriptors: Record<ViewMode, ModeDescriptor> = {
  linear: { comparative: false },
  dotplot: { viewType: 'DotplotView', comparative: true },
  synteny: { viewType: 'LinearSyntenyView', comparative: true },
  circular: { viewType: 'CircularView', comparative: false },
}

export const viewModes = Object.keys(modeDescriptors) as ViewMode[]

export function isViewMode(name: string): name is ViewMode {
  return name in modeDescriptors
}
