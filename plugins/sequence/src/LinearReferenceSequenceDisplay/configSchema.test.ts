import { readConfObject } from '@jbrowse/core/configuration'

import { configSchema } from './configSchema.ts'

test('a v4 show* toggle lands on its row part', () => {
  const conf = configSchema.create({
    type: 'LinearReferenceSequenceDisplay',
    displayId: 'refseq-LinearReferenceSequenceDisplay',
    showReverse: false,
    showTranslation: false,
  })
  expect(readConfObject(conf, ['forward', 'show'])).toBe(true)
  expect(readConfObject(conf, ['reverse', 'show'])).toBe(false)
  expect(readConfObject(conf, ['translation', 'show'])).toBe(false)
})
