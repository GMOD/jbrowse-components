// Names before isoforms, then names before body height: `thinned` shortens
// the bodies under a full set of names, and `decimated` keeps that floor
// while a name survives it.
// `bare` sits below `bodies` because subfeature labels are a config choice,
// given up only where the alternative squeezes bodies under rows the squeeze
// would hide anyway.
export const FIT_LADDER = [
  'full',
  'labels',
  'isoforms',
  'thinned',
  'decimated',
  'bodies',
  'bare',
] as const

export type FitLevel = (typeof FIT_LADDER)[number]
