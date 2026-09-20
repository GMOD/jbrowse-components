import { readConfObject } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

describe('BigMafAdapter configSchema', () => {
  test('summaryAdapter defaults to unset (no zoom-out summary)', () => {
    const conf = configSchema.create({ type: 'BigMafAdapter' })
    expect(readConfObject(conf, 'summaryAdapter')).toBeUndefined()
  })

  test('summaryAdapter stores a swappable sub-adapter config verbatim', () => {
    const summaryAdapter = {
      type: 'BigBedAdapter',
      bigBedLocation: { uri: 'https://example.com/x.summary.bb' },
    }
    const conf = configSchema.create({ type: 'BigMafAdapter', summaryAdapter })
    expect(readConfObject(conf, 'summaryAdapter')).toEqual(summaryAdapter)
  })

  test('annotationAdapter defaults to unset (no CDS-frames overlay)', () => {
    const conf = configSchema.create({ type: 'BigMafAdapter' })
    expect(readConfObject(conf, 'annotationAdapter')).toBeUndefined()
  })

  test('annotationAdapter stores the CDS-frames sub-adapter config verbatim', () => {
    const annotationAdapter = {
      type: 'BigBedAdapter',
      bigBedLocation: { uri: 'https://example.com/x.frames.bb' },
    }
    const conf = configSchema.create({
      type: 'BigMafAdapter',
      annotationAdapter,
    })
    expect(readConfObject(conf, 'annotationAdapter')).toEqual(annotationAdapter)
  })
})
