export type YMember =
  | 'type'
  | 'zero'
  | 'domainMin'
  | 'domainMax'
  | 'fence'
  | 'constant'
  | 'group'
  | 'title'
  | 'grid'
  | 'minimalTicks'
  | 'rules'

/**
 * Where each member of a display's y scale lives in its config. `reset` lists
 * the sub-objects a reset rewrites: resetting a whole `encoding.y` would also
 * revert a plotted field that lives beside the scale.
 */
export interface YScalePaths {
  members: Record<Exclude<YMember, 'minimalTicks'>, readonly string[]> & {
    minimalTicks?: readonly string[]
  }
  reset: readonly (readonly string[])[]
}

export const SCALES_Y_PATHS = {
  members: {
    type: ['scales', 'y', 'type'],
    zero: ['scales', 'y', 'zero'],
    domainMin: ['scales', 'y', 'domainMin'],
    domainMax: ['scales', 'y', 'domainMax'],
    fence: ['scales', 'y', 'domainQuantile'],
    constant: ['scales', 'y', 'symlogConstant'],
    group: ['scales', 'y', 'autoscaleGroup'],
    title: ['scales', 'y', 'title'],
    grid: ['scales', 'y', 'grid'],
    minimalTicks: ['scales', 'y', 'minimalTicks'],
    rules: ['scales', 'y', 'rules'],
  },
  reset: [['scales', 'y']],
} as const satisfies YScalePaths
