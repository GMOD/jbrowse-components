import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import { waitFor } from '@testing-library/react'

import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type { LinearReferenceSequenceDisplayModel } from './model.ts'

// A contig the FASTA does not cover: the adapter answers, and nothing it
// answers with carries a `seq`. That region is legitimately empty rather than
// unfetched, and it used to be the case the fail-open `regionHasData: true`
// was protecting — the display stamped `loadedRegions` while storing nothing,
// and a store-derived presence check would have re-issued it forever.
//
// Committing the empty record is what makes it terminal without the fail-open,
// so the pair below is one statement in two halves: what is stored, and that
// the store reads it as answered — which is the plan's `covered` verdict.
async function loadedOverEmptySequence() {
  const env = createDisplayTestEnvironment<LinearReferenceSequenceDisplayModel>(
    {
      plugins: [new LinearGenomeViewPlugin()],
      trackType: 'ReferenceSequenceTrack',
      adapter: { name: 'TestSequenceAdapter' },
      displayName: 'LinearReferenceSequenceDisplay',
      configSchema: () => configSchema,
      stateModel: (_pm, schema) => modelFactory(schema),
      viewModel: linearGenomeViewStateModelFactory,
      viewRegionEnd: 100,
      rpcCall: (_sessionId, method) =>
        method === 'CoreGetFeatures' ? [{ get: () => undefined }] : undefined,
    },
  )
  const { display } = env.createDisplay()
  await waitFor(() => {
    expect(display.loadedRegions.size).toBe(1)
  })
  return { display }
}

test('commits an empty record for a region the adapter has no sequence in', async () => {
  const { display } = await loadedOverEmptySequence()

  expect(display.sequenceData.get(0)).toEqual({
    seq: '',
    start: display.loadedRegions.get(0)!.start,
    geneticCodeId: 1,
  })
})

test('and reads it as answered, so the plan stops asking', async () => {
  const { display } = await loadedOverEmptySequence()

  expect(display.regionHasData(0)).toBe(true)
  expect(display.isCacheValid(0)).toBe(true)
})
