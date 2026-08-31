import { readConfObject } from '@jbrowse/core/configuration'

import bgzipMafConfigSchema from '../BgzipMafAdapter/configSchema.ts'
import bgzipTaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'
import bigMafConfigSchema from '../BigMafAdapter/configSchema.ts'
import mafTabixConfigSchema from '../MafTabixAdapter/configSchema.ts'
import { UNCONFIGURED_NH_URI, isUnconfiguredNhLocation } from './nhLocation.ts'

// The four schemas spell the placeholder as a literal so the config-doc
// generator can publish the path (it renders a default from the source text).
// This is what keeps the four literals and the one reader in agreement — a typo
// on either side makes that adapter fetch `/path/to/my.nh` and fail sample
// resolution with a 404 for a file nobody configured.
test.each([
  ['MafTabixAdapter', mafTabixConfigSchema],
  ['BigMafAdapter', bigMafConfigSchema],
  ['BgzipMafAdapter', bgzipMafConfigSchema],
  ['BgzipTaffyAdapter', bgzipTaffyConfigSchema],
])('%s reads its own nhLocation default as unconfigured', (_name, schema) => {
  expect(
    isUnconfiguredNhLocation(readConfObject(schema.create(), 'nhLocation')),
  ).toBe(true)
})

test('a configured tree is not the placeholder', () => {
  expect(isUnconfiguredNhLocation({ uri: '/data/tree.nh' })).toBe(false)
  expect(isUnconfiguredNhLocation({ localPath: UNCONFIGURED_NH_URI })).toBe(
    false,
  )
})
