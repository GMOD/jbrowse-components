import { setConf } from '@jbrowse/core/configuration'
import { DEFAULT_CANONICAL_TRANSCRIPTS } from '@jbrowse/core/util/isoformRank'

import { createTestEnvironment } from './testEnv.ts'

test('canonicalTranscripts hands the panel the tags the worker ranks by', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.canonicalTranscripts).toEqual(DEFAULT_CANONICAL_TRANSCRIPTS)

  setConf(display, 'canonicalTranscriptField', 'canonical')
  setConf(display, 'canonicalTranscriptTags', ['yes'])
  const { displayConfig } = display.rpcProps()
  expect(display.canonicalTranscripts).toEqual({
    field: displayConfig.canonicalTranscriptField,
    tags: displayConfig.canonicalTranscriptTags,
  })
  expect(display.canonicalTranscripts).toEqual({
    field: 'canonical',
    tags: ['yes'],
  })
})
