import { viewsToSession } from './createViewStateFromProps.ts'

describe('viewsToSession', () => {
  it('opens an empty named session when no views are given', () => {
    expect(viewsToSession('session', undefined)).toEqual({ name: 'session' })
    expect(viewsToSession('session', [])).toEqual({ name: 'session' })
  })

  it('maps a synteny view spec into a session view, defaulting the id', () => {
    const session = viewsToSession('s', [
      {
        type: 'LinearSyntenyView',
        init: {
          views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
          tracks: ['hg38_mm39.paf'],
        },
      },
    ])
    expect(session).toEqual({
      name: 's',
      views: [
        {
          id: 'view-0',
          type: 'LinearSyntenyView',
          init: {
            views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
            tracks: ['hg38_mm39.paf'],
          },
        },
      ],
    })
  })

  it('honors an explicit view id and preserves order for multiple views', () => {
    const session = viewsToSession('s', [
      { type: 'LinearGenomeView', id: 'top', init: { assembly: 'hg38' } },
      { type: 'DotplotView', init: { views: [{ assembly: 'a' }] } },
    ])
    expect(session.views?.map(v => v.id)).toEqual(['top', 'view-1'])
    expect(session.views?.map(v => v.type)).toEqual([
      'LinearGenomeView',
      'DotplotView',
    ])
  })
})
