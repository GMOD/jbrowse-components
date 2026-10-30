import type { YScalePaths } from '@jbrowse/wiggle-core'

const Y = ['encoding', 'y'] as const

/**
 * Where the wiggle display's y scale members live, checked against its schema
 * in `LinearWiggleDisplay/configSchema.ts`. A reset leaves `field` alone.
 */
export const WIGGLE_Y_PATHS = {
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
  reset: [
    [...Y, 'scale'],
    [...Y, 'axis'],
    [...Y, 'rules'],
  ],
} as const satisfies YScalePaths
