export type ViewMode =
  | 'linear'
  | 'dotplot'
  | 'synteny'
  | 'circular'
  | 'breakpoint'

export interface ModeDescriptor {
  subcommand: string
  viewType: string
  // takes a second assembly and comparison tracks
  comparative: boolean
}

export const modeDescriptors: Record<ViewMode, ModeDescriptor> = {
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
  // several panels, but of one assembly
  breakpoint: {
    subcommand: 'breakpoint',
    viewType: 'BreakpointSplitView',
    comparative: false,
  },
}

export const viewModes = Object.keys(modeDescriptors) as ViewMode[]

const subcommandToMode = new Map(
  viewModes.map(mode => [modeDescriptors[mode].subcommand, mode]),
)

export function subcommandMode(token: string) {
  return subcommandToMode.get(token)
}

export const subcommandTokens = viewModes.map(
  mode => modeDescriptors[mode].subcommand,
)

export const viewTypeModes = new Map(
  viewModes.map(mode => [modeDescriptors[mode].viewType, mode]),
)

export function subcommandForViewType(viewType: string) {
  const mode = viewTypeModes.get(viewType)
  return mode && modeDescriptors[mode].subcommand
}
