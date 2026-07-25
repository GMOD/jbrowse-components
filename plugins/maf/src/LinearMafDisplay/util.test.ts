import { getMsaHighlights } from './util.ts'

describe('getMsaHighlights', () => {
  test('returns empty when no MSA views are connected', () => {
    expect(getMsaHighlights([], 'view1')).toEqual([])
  })

  test('filters by connectedViewId', () => {
    const views = [
      {
        type: 'MsaView',
        connectedViewId: 'view1',
        connectedHighlights: [{ refName: 'chr1', start: 0, end: 10 }],
      },
      {
        type: 'MsaView',
        connectedViewId: 'view2',
        connectedHighlights: [{ refName: 'chr2', start: 0, end: 10 }],
      },
    ]
    expect(getMsaHighlights(views, 'view1')).toEqual([
      { refName: 'chr1', start: 0, end: 10 },
    ])
  })

  test('ignores non-MsaView entries', () => {
    const views = [
      {
        type: 'LinearGenomeView',
        connectedViewId: 'view1',
        connectedHighlights: [{ refName: 'chr1', start: 0, end: 10 }],
      },
    ]
    expect(getMsaHighlights(views, 'view1')).toEqual([])
  })

  test('handles MsaView with no highlights array', () => {
    const views = [{ type: 'MsaView', connectedViewId: 'view1' }]
    expect(getMsaHighlights(views, 'view1')).toEqual([])
  })

  test('handles null/undefined entries safely', () => {
    expect(getMsaHighlights([null, undefined, 'string'], 'view1')).toEqual([])
  })
})
