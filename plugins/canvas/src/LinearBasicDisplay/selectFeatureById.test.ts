import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

const eden1: SubfeatureInfo = {
  kind: 'subfeature',
  featureId: 'EDEN.1',
  type: 'mRNA',
  startBp: 1050,
  endBp: 9000,
  topPx: 0,
  bottomPx: 10,
  parentFeatureId: 'EDEN',
  displayLabel: 'EDEN.1',
}

const edenRecord = {
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
      end: 9000,
      type: 'mRNA',
      name: 'EDEN.1',
    },
  ],
}

function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display, mockRpcCall } = createDisplay()
  mockRpcCall.mockResolvedValue({ feature: undefined })
  display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
  return { display, mockRpcCall }
}

function fetchedIds(mockRpcCall: jest.Mock) {
  return mockRpcCall.mock.calls
    .filter(([, method]) => method === 'GetCanvasFeatureDetails')
    .map(([, , args]) => (args as { featureId: string }).featureId)
}

describe('selectFeatureById fetch target', () => {
  it('fetches the drawn feature for a plain feature click', async () => {
    const { display, mockRpcCall } = setup()
    display.selectFeatureById('EDEN', undefined, 0)

    await waitFor(() => {
      expect(fetchedIds(mockRpcCall)).toEqual(['EDEN'])
    })
  })

  it('fetches the drawn feature when the click resolved a subfeature', async () => {
    const { display, mockRpcCall } = setup()
    display.selectFeatureById('EDEN', eden1, 0)

    await waitFor(() => {
      expect(fetchedIds(mockRpcCall)).toEqual(['EDEN'])
    })
  })

  it('ignores a parentFeatureId naming something below the top level', async () => {
    const { display, mockRpcCall } = setup()
    display.selectFeatureById(
      'EDEN',
      { ...eden1, parentFeatureId: 'EDEN.1' },
      0,
    )

    await waitFor(() => {
      expect(fetchedIds(mockRpcCall)).toEqual(['EDEN'])
    })
  })
})

describe('the containing feature the panel is told about', () => {
  function setupOpening() {
    const { createDisplay } = createTestEnvironment()
    const { display, mockRpcCall, session } = createDisplay()
    mockRpcCall.mockImplementation(
      async (_sessionId: string, method: string) =>
        method === 'GetCanvasFeatureDetails'
          ? { feature: edenRecord }
          : undefined,
    )
    display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
    return { display, session }
  }

  async function openedWidget(session: { openedWidgets: unknown[] }) {
    await waitFor(() => {
      expect(session.openedWidgets).toHaveLength(1)
    })
    return session.openedWidgets[0] as Record<string, unknown>
  }

  it('names the gene an isoform click was made through', async () => {
    const { display, session } = setupOpening()
    display.selectFeatureById('EDEN', eden1, 0)

    const widget = await openedWidget(session)
    expect(widget.parentFeature).toEqual({ name: 'EDEN', type: 'gene' })
    expect(widget.featureData).toMatchObject({ uniqueId: 'EDEN.1' })
  })

  it('names nothing when the gene itself was clicked', async () => {
    const { display, session } = setupOpening()
    display.selectFeatureById('EDEN', undefined, 0)

    const widget = await openedWidget(session)
    expect(widget.parentFeature).toBeUndefined()
    expect(widget.featureData).toMatchObject({ uniqueId: 'EDEN' })
  })
})
