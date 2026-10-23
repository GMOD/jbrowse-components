import { DEFAULT_CLIP_QUANTILE } from '@jbrowse/core/util/quantileExtent'

import type { YMember, YScalePaths } from './yScalePaths.ts'

type YMembers = YScalePaths['members']

/**
 * The member names v5's `scales.y` used, frozen where the lifts below read
 * them. `minimalTicks` is not one: a `scales.y` naming it loses it.
 */
const SCALES_Y_NAMES = {
  type: 'type',
  zero: 'zero',
  domainMin: 'domainMin',
  domainMax: 'domainMax',
  fence: 'domainQuantile',
  constant: 'symlogConstant',
  group: 'autoscaleGroup',
  title: 'title',
  grid: 'grid',
  rules: 'rules',
} as const satisfies Record<YMember, string>

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

function nestedAt(entries: (readonly [readonly string[], unknown])[]) {
  const out: Record<string, unknown> = {}
  for (const [path, value] of entries) {
    let node = out
    for (const segment of path.slice(0, -1)) {
      node = (node[segment] ??= {}) as Record<string, unknown>
    }
    node[path.at(-1)!] = value
  }
  return out
}

/**
 * The axis guides v4 spelt on the display, as `retired` declares them on each
 * display whose scale took them over, at that display's member paths.
 * `minimalTicks` has no successor and is let go.
 */
export function retiredAxisSpellings(members: YMembers) {
  return {
    displayCrossHatches: (grid: unknown) => nestedAt([[members.grid, grid]]),
    minimalTicks: () => ({}),
  }
}

/**
 * v4's display-level scale settings as the y scale members they became, at
 * the display's member paths. `localpercentile` is a clip; `local`,
 * `localsd`, `global` and `globalsd` all follow the extremes closely enough to
 * become one.
 */
export function valueScaleOf(members: YMembers) {
  return ({ scale, autoscale, constraints }: Record<string, unknown>) =>
    nestedAt([
      ...(typeof scale === 'string' ? [[members.type, scale] as const] : []),
      ...(typeof autoscale === 'string'
        ? [
            [
              members.fence,
              autoscale === 'localpercentile' ? DEFAULT_CLIP_QUANTILE : 1,
            ] as const,
          ]
        : []),
      ...(isRecord(constraints) && typeof constraints.min === 'number'
        ? [[members.domainMin, constraints.min] as const]
        : []),
      ...(isRecord(constraints) && typeof constraints.max === 'number'
        ? [[members.domainMax, constraints.max] as const]
        : []),
    ])
}

/**
 * The scale slots v4 declared on a display, as `retired` declares them on
 * each display whose y scale took them over, at its member paths. `minScore`
 * and `maxScore` were unset at v4's own sentinels; `numStdDev` and `inverted`
 * have no successor and are let go. A `null` resets the member it became.
 */
export function retiredScaleSpellings(members: YMembers) {
  const lift = valueScaleOf(members)
  const orReset =
    (member: YMember, lifted: (value: unknown) => Record<string, unknown>) =>
    (value: unknown) =>
      value === null ? nestedAt([[members[member], null]]) : lifted(value)
  return {
    scaleType: orReset('type', scale => lift({ scale })),
    autoscale: orReset('fence', autoscale => lift({ autoscale })),
    minScore: orReset('domainMin', min =>
      min === Number.MIN_VALUE ? {} : lift({ constraints: { min } }),
    ),
    maxScore: orReset('domainMax', max =>
      max === Number.MAX_VALUE ? {} : lift({ constraints: { max } }),
    ),
    numStdDev: () => ({}),
    inverted: () => ({}),
  }
}

/**
 * v5's `scales.y` as the members a display moved off it, at its member paths:
 * `domainQuantile` becomes the `fence` member, `symlogConstant` the
 * `constant` and `autoscaleGroup` the `group`. A `null` for either
 * resets every member, as it reset the whole `scales.y`.
 */
export function retiredScalesSpelling(members: YMembers) {
  return (scales: unknown) => {
    const y = scales === null ? null : isRecord(scales) ? scales.y : undefined
    return y === null
      ? nestedAt(Object.values(members).map(path => [path, null] as const))
      : isRecord(y)
        ? nestedAt(
            Object.entries(SCALES_Y_NAMES).flatMap(([member, name]) =>
              name in y ? [[members[member as YMember], y[name]] as const] : [],
            ),
          )
        : {}
  }
}
