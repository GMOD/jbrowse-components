import ActionClassifier from '../src/ActionLogger/ActionClassifier.ts'
import { ActionType } from '../src/ActionLogger/ActionTypes.ts'

describe('ActionClassifier', () => {
  let classifier: ActionClassifier

  beforeEach(() => {
    classifier = new ActionClassifier()
  })

  it('classifies zoom in (bpPerPx decreased)', () => {
    const result = classifier.classify(
      { op: 'replace', path: '/views/0/bpPerPx', value: 0.5 },
      { op: 'replace', path: '/views/0/bpPerPx', value: 1.0 },
    )
    expect(result.type).toBe(ActionType.ZOOM_IN)
    expect(result.metadata.zoomFactor).toBe(2)
  })

  it('classifies zoom out (bpPerPx increased)', () => {
    const result = classifier.classify(
      { op: 'replace', path: '/views/0/bpPerPx', value: 2.0 },
      { op: 'replace', path: '/views/0/bpPerPx', value: 1.0 },
    )
    expect(result.type).toBe(ActionType.ZOOM_OUT)
    expect(result.metadata.zoomFactor).toBe(0.5)
  })

  it('classifies pan right (offsetPx increased)', () => {
    const result = classifier.classify(
      { op: 'replace', path: '/views/0/offsetPx', value: 500 },
      { op: 'replace', path: '/views/0/offsetPx', value: 400 },
    )
    expect(result.type).toBe(ActionType.PAN_RIGHT)
    expect(result.metadata.deltaPixels).toBe(100)
  })

  it('classifies pan left (offsetPx decreased)', () => {
    const result = classifier.classify(
      { op: 'replace', path: '/views/0/offsetPx', value: 300 },
      { op: 'replace', path: '/views/0/offsetPx', value: 400 },
    )
    expect(result.type).toBe(ActionType.PAN_LEFT)
    expect(result.metadata.deltaPixels).toBe(-100)
  })

  it('classifies search (displayedRegions replaced)', () => {
    const result = classifier.classify(
      {
        op: 'replace',
        path: '/views/0/displayedRegions',
        value: [{ refName: 'chr7', start: 0, end: 1000 }],
      },
      { op: 'replace', path: '/views/0/displayedRegions', value: [] },
    )
    expect(result.type).toBe(ActionType.SEARCH)
  })

  it('classifies track add', () => {
    const result = classifier.classify(
      {
        op: 'add',
        path: '/views/0/tracks/0',
        value: { trackId: 'genes' },
      },
      { op: 'remove', path: '/views/0/tracks/0', value: undefined },
    )
    expect(result.type).toBe(ActionType.TOGGLE_TRACK)
    expect(result.metadata.added).toBe(true)
    expect(result.metadata.trackId).toBe('genes')
  })

  it('classifies track remove', () => {
    const result = classifier.classify(
      {
        op: 'remove',
        path: '/views/0/tracks/0',
        value: { trackId: 'genes' },
      },
      { op: 'add', path: '/views/0/tracks/0', value: undefined },
    )
    expect(result.type).toBe(ActionType.TOGGLE_TRACK)
    expect(result.metadata.added).toBe(false)
  })

  it('classifies widget open', () => {
    const result = classifier.classify(
      {
        op: 'add',
        path: '/widgets/widget-1',
        value: { type: 'BaseFeatureWidget' },
      },
      { op: 'remove', path: '/widgets/widget-1', value: undefined },
    )
    expect(result.type).toBe(ActionType.OPEN_WIDGET)
  })

  it('classifies widget close', () => {
    const result = classifier.classify(
      { op: 'remove', path: '/widgets/widget-1', value: undefined },
      { op: 'add', path: '/widgets/widget-1', value: undefined },
    )
    expect(result.type).toBe(ActionType.CLOSE_WIDGET)
  })

  it('classifies view add', () => {
    const result = classifier.classify(
      {
        op: 'add',
        path: '/views/1',
        value: { type: 'LinearGenomeView' },
      },
      { op: 'remove', path: '/views/1', value: undefined },
    )
    expect(result.type).toBe(ActionType.ADD_VIEW)
  })

  it('returns UNKNOWN for unrecognized patches', () => {
    const result = classifier.classify(
      { op: 'replace', path: '/some/random/path', value: 42 },
      { op: 'replace', path: '/some/random/path', value: 41 },
    )
    expect(result.type).toBe(ActionType.UNKNOWN)
  })

  it('includes timestamp on all actions', () => {
    const before = Date.now()
    const result = classifier.classify(
      { op: 'replace', path: '/views/0/bpPerPx', value: 0.5 },
      { op: 'replace', path: '/views/0/bpPerPx', value: 1.0 },
    )
    expect(result.timestamp).toBeGreaterThanOrEqual(before)
    expect(result.timestamp).toBeLessThanOrEqual(Date.now())
  })

  it('handles multiple view indices', () => {
    const result = classifier.classify(
      { op: 'replace', path: '/views/3/bpPerPx', value: 0.5 },
      { op: 'replace', path: '/views/3/bpPerPx', value: 1.0 },
    )
    expect(result.type).toBe(ActionType.ZOOM_IN)
  })
})
