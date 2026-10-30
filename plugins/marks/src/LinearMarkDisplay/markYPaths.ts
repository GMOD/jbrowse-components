import type { YScalePaths } from '@jbrowse/wiggle-core'

const Y = ['encoding', 'y'] as const

/**
 * Where the mark display's y scale members live, checked against its schema
 * in `configSchema.ts`.
 */
export const MARK_Y_PATHS = {
  members: {
    type: [...Y, 'scale', 'type'],
    zero: [...Y, 'scale', 'zero'],
    domainMin: [...Y, 'scale', 'domainMin'],
    domainMax: [...Y, 'scale', 'domainMax'],
    fence: [...Y, 'scale', 'fenceQuantile'],
    constant: [...Y, 'scale', 'constant'],
    group: [...Y, 'scale', 'group'],
    title: [...Y, 'axis', 'title'],
    show: [...Y, 'axis', 'show'],
    grid: [...Y, 'axis', 'grid'],
    rules: [...Y, 'rules'],
  },
  reset: [Y],
} as const satisfies YScalePaths
