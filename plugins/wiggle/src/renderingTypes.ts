// Pure data, no imports: the wiggle rendering-type table. Kept UI-free (this
// file reaches nothing that pulls in React/.tsx) so non-UI consumers — the docs'
// spec-recipe field map among them — can import the menu labels without dragging
// in the whole wiggle-core barrel. util.ts re-exports these for existing callers.

// Single source of truth for rendering types: [value, menu label]. The config
// enumeration derives its valid values from these, and the track menu derives
// its radio items — so the two can't drift. The layout is `facet`'s rather than
// a rendering's: each of these draws the same whether the sources share one plot
// or take a row each.
export const WIGGLE_RENDERINGS = [
  ['xyplot', 'XY plot'],
  ['density', 'Density'],
  ['line', 'Line (step)'],
  ['linecenter', 'Line (interpolated)'],
  ['scatter', 'Scatter'],
] as const

export const WIGGLE_RENDERING_TYPES = WIGGLE_RENDERINGS.map(([value]) => value)
