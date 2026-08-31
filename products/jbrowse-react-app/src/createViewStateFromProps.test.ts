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
        views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
        tracks: ['hg38_mm39.paf'],
      },
    ])
    expect(session).toEqual({
      name: 's',
      views: [
        {
          id: 'view-0',
          type: 'LinearSyntenyView',
          views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
          tracks: ['hg38_mm39.paf'],
        },
      ],
    })
  })

  it('carries a persisted view property through beside the launch keys', () => {
    const session = viewsToSession('s', [
      { type: 'LinearGenomeView', assembly: 'hg38', colorByCDS: true },
    ])
    expect(session.views?.[0]).toEqual({
      id: 'view-0',
      type: 'LinearGenomeView',
      assembly: 'hg38',
      colorByCDS: true,
    })
  })

  it('still carries a deprecated nested init', () => {
    const session = viewsToSession('s', [
      { type: 'LinearGenomeView', init: { assembly: 'hg38' } },
    ])
    expect(session.views?.[0]).toEqual({
      id: 'view-0',
      type: 'LinearGenomeView',
      init: { assembly: 'hg38' },
    })
  })

  it('honors an explicit view id and preserves order for multiple views', () => {
    const session = viewsToSession('s', [
      { type: 'LinearGenomeView', id: 'top', assembly: 'hg38' },
      { type: 'DotplotView', views: [{ assembly: 'a' }] },
    ])
    expect(session.views?.map(v => v.id)).toEqual(['top', 'view-1'])
    expect(session.views?.map(v => v.type)).toEqual([
      'LinearGenomeView',
      'DotplotView',
    ])
  })
})
