import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  contextMenuLabels,
  createTestEnvironment,
} from './testEnv.ts'

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

it('sends the worker the feature span and nothing of the loaded payload', async () => {
  const { display, mockRpcCall } = setup()
  display.selectFeatureById('EDEN', undefined, 0)

  await waitFor(() => {
    expect(fetchedIds(mockRpcCall)).toEqual(['EDEN'])
  })
  const [, , args] = mockRpcCall.mock.calls.find(
    ([, method]) => method === 'GetCanvasFeatureDetails',
  )!
  expect((args as { region: unknown }).region).toEqual({
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 1050,
    end: 9000,
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

describe('a protein domain click', () => {
  const sh2: SubfeatureInfo = {
    ...eden1,
    featureId: 'EDEN.1-domain-0-1',
    type: 'protein_domain',
    startBp: 2000,
    endBp: 2100,
    displayLabel: 'SH2',
    domainId: 'pfam_domains-4096',
  }

  it("fetches the domain from the proteinFeatures track's adapter over its block", async () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { proteinFeatures: 'test_track' },
    })
    const { display, mockRpcCall } = createDisplay()
    mockRpcCall.mockResolvedValue({ feature: undefined })
    display.setRpcData(0, makeFeatureData({ flatbushItems: [gene] }), ctgA)
    display.selectFeatureById('EDEN', sh2, 0)

    await waitFor(() => {
      expect(fetchedIds(mockRpcCall)).toEqual(['pfam_domains-4096'])
    })
    const [, , args] = mockRpcCall.mock.calls.find(
      ([, method]) => method === 'GetCanvasFeatureDetails',
    )!
    expect(args).toMatchObject({
      adapterConfig: display.proteinFeaturesArg!.adapter,
      region: { refName: 'ctgA', start: 2000, end: 2100 },
    })
  })

  it('right-clicked, acts on its transcript and offers the whole domain', async () => {
    const { createDisplay } = createTestEnvironment({
      displayConfig: { proteinFeatures: 'test_track' },
    })
    const { display, mockRpcCall } = createDisplay()
    mockRpcCall.mockResolvedValue({ feature: undefined })
    const domain = { ...sh2, transcriptId: 'EDEN.1' }
    const secondBlock = {
      ...domain,
      featureId: 'EDEN.1-domain-0-2',
      startBp: 3000,
      endBp: 3100,
    }
    display.setRpcData(
      0,
      makeFeatureData({
        flatbushItems: [gene],
        subfeatureInfos: [eden1, domain, secondBlock],
      }),
      ctgA,
    )
    display.openContextMenu({
      item: gene,
      subfeature: eden1,
      domain,
      displayedRegionIndex: 0,
      clientX: 0,
      clientY: 0,
    })
    expect(contextMenuLabels(display)).toEqual(
      expect.arrayContaining([
        'Open SH2 details',
        'protein_domain (SH2)',
        'mRNA (EDEN.1)',
        'Copy EDEN.1 attributes (JSON)',
      ]),
    )
    clickContextMenuItem(display, 'protein_domain (SH2)')
    expect(display.featureHighlights).toEqual([
      expect.objectContaining({ start: 2000, end: 3100 }),
    ])
    clickContextMenuItem(display, 'Open SH2 details')
    await waitFor(() => {
      expect(fetchedIds(mockRpcCall)).toEqual(['pfam_domains-4096'])
    })
  })

  it('fetches the gene while the display names no domain track', async () => {
    const { display, mockRpcCall } = setup()
    display.selectFeatureById('EDEN', sh2, 0)

    await waitFor(() => {
      expect(fetchedIds(mockRpcCall)).toEqual(['EDEN'])
    })
  })
})
