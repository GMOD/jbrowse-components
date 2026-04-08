import WebhookExporter from '../Export/WebhookExporter.ts'
import type { Step } from '../RLPipeline/types.ts'

function makeStep(overrides: Partial<Step> = {}): Step {
  return {
    timestamp: Date.now(),
    state: {
      bpPerPx: 1,
      offsetPx: 0,
      viewWidthPx: 800,
      assemblyName: 'hg38',
      refName: 'chr1',
      startBp: 0,
      endBp: 800,
      viewportBp: 800,
      viewportCenterBp: 400,
      displayedRegions: [],
      zoomLevel: 'gene',
      activeTracks: [],
      numTracks: 0,
      visibleContentBlocks: 0,
      hasReferenceSequence: false,
      hasGeneTrack: false,
      hasAlignmentTrack: false,
      hasVariantTrack: false,
      hasQuantitativeTrack: false,
      labelsVisible: true,
      openWidgets: [],
      timeSinceLastAction: 0,
      actionsInLast5Seconds: 0,
      sessionDurationMs: 0,
      actionCountsByType: {},
      uniqueRefNamesVisited: [],
      totalActionsThisSession: 0,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: 'ZOOM' as any,
    actionMetadata: {},
    reward: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nextState: {} as any,
    terminal: false,
    ...overrides,
  }
}

describe('WebhookExporter', () => {
  let mockFetch: jest.Mock
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    mockFetch = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = mockFetch as unknown as typeof global.fetch
    jest.useFakeTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('flushes on batch size reached', async () => {
    const exporter = new WebhookExporter('http://test/ingest', 3, 5000)
    exporter.start()

    exporter.push(makeStep({ timestamp: 1 }), 'ep1')
    exporter.push(makeStep({ timestamp: 2 }), 'ep1')
    expect(mockFetch).not.toHaveBeenCalled()

    exporter.push(makeStep({ timestamp: 3 }), 'ep1')
    // third push triggers flush
    await Promise.resolve()
    await Promise.resolve()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.steps).toHaveLength(3)
    expect(body.steps[0].episode_id).toBe('ep1')
    expect(body.steps[0].timestamp).toBe(1)

    exporter.dispose()
  })

  it('flushes on interval', async () => {
    const exporter = new WebhookExporter('http://test/ingest', 100, 5000)
    exporter.start()

    exporter.push(makeStep(), 'ep1')
    exporter.push(makeStep(), 'ep1')

    // Advance past the flush interval
    jest.advanceTimersByTime(5001)
    await Promise.resolve()
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body as string)
    expect(body.steps).toHaveLength(2)

    exporter.dispose()
  })

  it('does not POST when buffer is empty', async () => {
    const exporter = new WebhookExporter('http://test/ingest', 10, 5000)
    exporter.start()

    jest.advanceTimersByTime(5001)
    await Promise.resolve()

    expect(mockFetch).not.toHaveBeenCalled()
    exporter.dispose()
  })

  it('restores buffer on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'))
    const exporter = new WebhookExporter('http://test/ingest', 2, 5000)
    exporter.start()

    exporter.push(makeStep({ timestamp: 1 }), 'ep1')
    exporter.push(makeStep({ timestamp: 2 }), 'ep1')
    await Promise.resolve()
    await Promise.resolve()

    // First attempt failed, buffer should contain the 2 steps again
    mockFetch.mockResolvedValueOnce({ ok: true })
    await exporter.flush()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    exporter.dispose()
  })

  it('dispose() uses sendBeacon for final flush when available', () => {
    const mockBeacon = jest.fn().mockReturnValue(true)
    // Install sendBeacon on the existing navigator object (jsdom)
    const origBeacon = (
      global.navigator as Navigator & { sendBeacon?: unknown }
    ).sendBeacon
    Object.defineProperty(global.navigator, 'sendBeacon', {
      value: mockBeacon,
      configurable: true,
      writable: true,
    })

    const exporter = new WebhookExporter('http://test/ingest', 100, 5000)
    exporter.start()
    exporter.push(makeStep(), 'ep1')
    exporter.dispose()

    expect(mockBeacon).toHaveBeenCalledWith(
      'http://test/ingest',
      expect.any(String),
    )

    if (origBeacon) {
      Object.defineProperty(global.navigator, 'sendBeacon', {
        value: origBeacon,
        configurable: true,
        writable: true,
      })
    }
  })

  it('empty URL disables the exporter', () => {
    const exporter = new WebhookExporter('', 10, 5000)
    exporter.start()
    exporter.push(makeStep(), 'ep1')
    jest.advanceTimersByTime(10000)
    expect(mockFetch).not.toHaveBeenCalled()
    exporter.dispose()
  })
})
