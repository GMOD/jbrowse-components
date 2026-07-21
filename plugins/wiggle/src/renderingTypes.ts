// Pure data, no imports: the wiggle rendering-type tables. Kept UI-free (this
// file reaches nothing that pulls in React/.tsx) so non-UI consumers — the docs'
// spec-recipe field map among them — can import the menu labels without dragging
// in the whole wiggle-core barrel. util.ts re-exports these for existing callers.

// Single source of truth for rendering types: [value, menu label]. The config
// enumeration derives its valid values from these, and the track menu derives
// its radio items — so the two can't drift.
export const WIGGLE_RENDERINGS = [
  ['xyplot', 'XY plot'],
  ['density', 'Density'],
  ['line', 'Line (step)'],
  ['linecenter', 'Line (interpolated)'],
  ['scatter', 'Scatter'],
] as const

// Multi-wiggle plot types grouped by layout for the nested "Plot type" menu:
// the group header carries the layout qualifier so each plot-type label can
// drop it. Overlapping intentionally omits density — overlapping filled
// densities are unreadable.
export const MULTI_WIGGLE_RENDERING_GROUPS = [
  [
    'Multi-row',
    [
      ['multirowxy', 'XY plot'],
      ['multirowdensity', 'Density'],
      ['multirowline', 'Line (step)'],
      ['multirowlinecenter', 'Line (interpolated)'],
      ['multirowscatter', 'Scatter'],
    ],
  ],
  [
    'Overlapping',
    [
      ['multixyplot', 'XY plot'],
      ['multiline', 'Line (step)'],
      ['multilinecenter', 'Line (interpolated)'],
      ['multiscatter', 'Scatter'],
    ],
  ],
] as const

export const WIGGLE_RENDERING_TYPES = WIGGLE_RENDERINGS.map(([value]) => value)

export const MULTI_WIGGLE_RENDERING_TYPES =
  MULTI_WIGGLE_RENDERING_GROUPS.flatMap(([, options]) =>
    options.map(([value]) => value),
  )
