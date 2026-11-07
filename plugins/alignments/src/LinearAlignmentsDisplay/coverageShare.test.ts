import { COVERAGE_Y_PATHS } from '@jbrowse/alignments-core/coverageBandConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { readYMember } from '@jbrowse/wiggle-core'

import configSchemaFactory from './configSchema.ts'

test("the coverage band's shared axis name reads where the axis panel writes it", () => {
  const conf = configSchemaFactory(new PluginManager()).create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'd',
    coverage: { encoding: { y: { scale: { share: 'depth' } } } },
  })
  expect(readYMember(conf, COVERAGE_Y_PATHS, 'share')).toBe('depth')
})
