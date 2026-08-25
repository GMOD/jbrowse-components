import {
  REMOVAL_GROUPS,
  SESSION_AND_PLUGIN_REMOVALS,
  SUBPATH_REMOVALS,
} from './knownRemovals.ts'
import libs from './modules.ts'

// The two arrays in this file are read by different machines, and filing an
// entry in the wrong one is silent both ways.
//
// `REMOVAL_GROUPS` is gated: `abiPreviousRelease.test.ts` walks it against the
// exports of the last published `@jbrowse/core`, so a name that came back, or
// one the previous release never served, is reported. `SESSION_AND_PLUGIN_
// REMOVALS` has no gate at all — those surfaces are unobserved, which is the
// reason it exists — so an entry put there is published and never checked.
//
// The dangerous direction is a `@jbrowse/core/*` name filed as a session or
// plugin one: it reads as recorded, it reaches the upgrade guide, and it skips
// the only test that would have said the name was still being served. That is
// what this file fails.
describe('the removal record', () => {
  it('keeps @jbrowse/core module names in the gated array', () => {
    const misfiled = SESSION_AND_PLUGIN_REMOVALS.flatMap(g =>
      [...Object.keys(g.gone), ...Object.keys(g.changed)].filter(name =>
        name.includes('@jbrowse/core'),
      ),
    )
    expect(misfiled).toEqual([])
  })

  // The other half of the same mistake: a session or plugin name written as a
  // `module#name` key against a module the host serves would be checked by
  // abiPreviousRelease's stale test rather than published here, and the two
  // disagree about what the key means.
  it('keys the gated array on modules the host actually serves', () => {
    const unserved = REMOVAL_GROUPS.flatMap(g =>
      Object.keys(g.names).filter(key => {
        // a default rather than `!`: `key! in libs` reads as `!(key in libs)`
        const [module = ''] = key.split('#')
        return !(module in libs)
      }),
    )
    expect(unserved).toEqual([])
  })

  it('gives every session and plugin entry a published reason', () => {
    const unexplained = SESSION_AND_PLUGIN_REMOVALS.flatMap(g =>
      [...Object.entries(g.gone), ...Object.entries(g.changed)]
        .filter(([, reason]) => reason.trim() === '')
        .map(([name]) => name),
    )
    expect(unexplained).toEqual([])
  })

  // A name recorded twice is a name whose two reasons can disagree, and the
  // upgrade guide would print both.
  it('records each session and plugin name once per surface', () => {
    const keys = SESSION_AND_PLUGIN_REMOVALS.flatMap(g =>
      [...Object.keys(g.gone), ...Object.keys(g.changed)].map(
        name => `${g.surface}#${name}`,
      ),
    )
    expect(keys).toEqual([...new Set(keys)])
  })

  // `SUBPATH_REMOVALS` is keyed on `exports`-map keys, which start `./`. A
  // module path written the `@jbrowse/core/x` way resolves to nothing on either
  // side of the comparison, so abiPreviousRelease's stale test would report it
  // — but it would say "the release never served it", which names the wrong
  // mistake.
  it('keys the subpath array the way the exports map does', () => {
    const misshapen = SUBPATH_REMOVALS.flatMap(g =>
      Object.entries(g.subpaths)
        .filter(([key, reason]) => !key.startsWith('./') || !reason.trim())
        .map(([key]) => key),
    )
    expect(misshapen).toEqual([])
  })
})
