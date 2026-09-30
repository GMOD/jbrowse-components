import { briefedRoutes, rollUpRoutes, routesUsed } from './jbUsage.ts'

const help = `Orient first: jb.sessionSummary(). Arrange views with
session.layoutViews({ direction: 'horizontal' }); await view.launchTrack(id);
filter with activeDisplay.setFilter(['jexl:x']).`

describe('briefedRoutes', () => {
  it('unions the live members with the routes the briefing names', () => {
    expect(briefedRoutes(help, ['sessionSummary', 'getFeatures'])).toEqual([
      'getFeatures',
      'launchTrack',
      'layoutViews',
      'sessionSummary',
      'setFilter',
    ])
  })
})

describe('routesUsed', () => {
  const routes = ['getFeatures', 'view', 'layoutViews']

  it('finds a dotted call and ignores a longer name', () => {
    expect(routesUsed('await jb.getFeatures({})', routes)).toEqual([
      'getFeatures',
    ])
    expect(routesUsed('jb.viewport()', routes)).toEqual([])
  })

  it('finds a route taken by destructuring jb', () => {
    expect(routesUsed('const { getFeatures: gf, view } = jb', routes)).toEqual([
      'getFeatures',
      'view',
    ])
  })
})

describe('rollUpRoutes', () => {
  it('splits reaching runs by verdict and keeps an unreached route at zero', () => {
    const rows = rollUpRoutes(
      [
        { pass: true, routeCalls: { a: 2 }, routeErrors: {} },
        { pass: false, routeCalls: { a: 1 }, routeErrors: { a: 1 } },
      ],
      ['a', 'b'],
    )
    expect(rows).toEqual([
      { route: 'a', calls: 3, errors: 1, passedRuns: 1, failedRuns: 1 },
      { route: 'b', calls: 0, errors: 0, passedRuns: 0, failedRuns: 0 },
    ])
  })
})
