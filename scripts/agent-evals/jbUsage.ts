// Which parts of the `jb` surface an agent run reaches. The routes come from
// the live object: every member of `Object.keys(jb)`, plus each `jb.x`,
// `view.x`, `track.x`, `session.x` or `activeDisplay.x` the briefing string
// names, so a route added to the object or to `jb.help` is measured without a
// list kept here.

const BRIEFED = /\b(?:jb|view|track|session|activeDisplay)\.(\w+)/g
const DESTRUCTURED = /\{([^}]*)\}\s*=\s*jb\b/g

export function briefedRoutes(help: string, members: string[]) {
  const named = [...help.matchAll(BRIEFED)].map(m => m[1]!)
  return [...new Set([...members, ...named])].sort()
}

export function routesUsed(code: string, routes: string[]) {
  const destructured = new Set(
    [...code.matchAll(DESTRUCTURED)].flatMap(m =>
      m[1]!.split(',').map(s => s.split(':')[0]!.trim()),
    ),
  )
  return routes.filter(
    route => destructured.has(route) || new RegExp(`\\.${route}\\b`).test(code),
  )
}

export interface RouteRun {
  pass: boolean
  routeCalls: Record<string, number>
  routeErrors: Record<string, number>
}

export interface RouteRow {
  route: string
  calls: number
  errors: number
  passedRuns: number
  failedRuns: number
}

// A route no run reached has calls 0. Whether it may go is a separate test: a
// briefed route nothing exercises needs a task before it needs a verdict.
export function rollUpRoutes(runs: RouteRun[], routes: string[]) {
  return routes.map<RouteRow>(route => {
    const reaching = runs.filter(r => (r.routeCalls[route] ?? 0) > 0)
    return {
      route,
      calls: reaching.reduce((a, r) => a + (r.routeCalls[route] ?? 0), 0),
      errors: runs.reduce((a, r) => a + (r.routeErrors[route] ?? 0), 0),
      passedRuns: reaching.filter(r => r.pass).length,
      failedRuns: reaching.filter(r => !r.pass).length,
    }
  })
}
