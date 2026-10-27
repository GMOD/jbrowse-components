import { yChannelSchema } from './yChannelConfigSchema.ts'
import { readYMember } from './yScaleRead.ts'

import type { YScalePaths } from './yScalePaths.ts'

const PATHS = {
  members: {
    type: ['scale', 'type'],
    zero: ['scale', 'zero'],
    domainMin: ['scale', 'domainMin'],
    domainMax: ['scale', 'domainMax'],
    fence: ['scale', 'fenceQuantile'],
    constant: ['scale', 'constant'],
    group: ['scale', 'group'],
    title: ['axis', 'title'],
    grid: ['axis', 'grid'],
    rules: ['rules'],
  },
  reset: [],
} as const satisfies YScalePaths

test('readYMember reads each member as its slot type', () => {
  const conf = yChannelSchema().create({
    scale: { type: 'log', domainMax: 100 },
    axis: { title: 'depth' },
  })
  const type: 'linear' | 'log' | 'symlog' = readYMember(conf, PATHS, 'type')
  const zero: boolean = readYMember(conf, PATHS, 'zero')
  const domainMin: number | undefined = readYMember(conf, PATHS, 'domainMin')
  const domainMax: number | undefined = readYMember(conf, PATHS, 'domainMax')
  const title: string | undefined = readYMember(conf, PATHS, 'title')
  expect({ type, zero, domainMin, domainMax, title }).toEqual({
    type: 'log',
    zero: true,
    domainMin: undefined,
    domainMax: 100,
    title: 'depth',
  })

  // Typecheck-only: an unused @ts-expect-error fails `pnpm typecheck`.
  const mistyped = () => [
    // @ts-expect-error a boolean member does not read as a string
    readYMember(conf, PATHS, 'zero') satisfies string,
    // @ts-expect-error the rules are nodes, read through yRuleNodes
    readYMember(conf, PATHS, 'rules'),
  ]
  expect(mistyped).toBeInstanceOf(Function)
})
