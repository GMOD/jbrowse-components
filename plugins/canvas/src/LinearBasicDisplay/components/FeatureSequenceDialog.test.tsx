import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from '../testEnv.ts'
import FeatureSequenceDialog from './FeatureSequenceDialog.tsx'

afterEach(cleanup)

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

const fullGene = {
  uniqueId: 'EDEN',
  refName: 'ctgA',
  start: 1050,
  end: 9000,
  type: 'gene',
  name: 'EDEN',
  subfeatures: [
    {
      uniqueId: 'EDEN.1',
      refName: 'ctgA',
      start: 1050,
      end: 3902,
      type: 'mRNA',
      name: 'EDEN.1',
      subfeatures: [
        {
          uniqueId: 'e1',
          refName: 'ctgA',
          start: 1050,
          end: 1500,
          type: 'exon',
        },
      ],
    },
  ],
}

function renderDialog(featureId: string) {
  const { createDisplay } = createTestEnvironment()
  const { display, session, mockRpcCall } = createDisplay()
  mockRpcCall.mockResolvedValue({ feature: fullGene })
  display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
  display.setLoadedRegion(0, ctgA)
  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FeatureSequenceDialog
        model={display}
        parentFeatureId="EDEN"
        featureId={featureId}
        displayedRegionIndex={0}
        assemblyName="volvox"
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
  return { session }
}

describe('the feature sequence dialog', () => {
  it('shows the clicked transcript without a word', async () => {
    const { session } = renderDialog('EDEN.1')
    await screen.findByText('Feature sequence - EDEN.1')
    expect(session.notifications).toEqual([])
  })

  // The painting ships slim arrays, so the transcript is looked up by id inside
  // the re-fetched gene. When that lookup misses, the panel used to show the
  // gene under a title the reader had no reason to doubt.
  it('says so when it falls back to the parent feature', async () => {
    const { session } = renderDialog('EDEN.9')
    await screen.findByText('Feature sequence - EDEN')
    await waitFor(() => {
      expect(session.notifications).toEqual([
        {
          message:
            'Could not find the clicked transcript "EDEN.9"; showing the sequence of EDEN instead',
          level: 'warning',
          actions: [],
        },
      ])
    })
  })
})
