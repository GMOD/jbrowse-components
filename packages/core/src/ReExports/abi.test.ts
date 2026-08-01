import baseline from './abiBaseline.json'
import libs from './modules.ts'

// The `@jbrowse/core/*` entries in `libs` are the runtime ABI that external
// plugins link against: a plugin's build externalizes these paths, so at runtime
// a bare import resolves to a property lookup on the host's JBrowseExports. A
// name that disappears from one of these modules therefore doesn't fail the
// plugin's type check, its lint, or its bundle -- it becomes `undefined` inside
// an already-published UMD, on hosts nobody is going to rebuild.
//
// That failure mode is worse than a broken feature. Plugin bundles read these at
// module scope, and PluginLoader runs Promise.all over the plugin list, so a
// throw while evaluating means the plugin's global is never assigned and the
// whole app goes to its error page for every config naming it.
//
// It has happened: dropping `defaultCodonTable` from the util barrel turned
// `generateCodonTable(defaultCodonTable)` into `Object.keys(undefined)` inside
// published jbrowse-plugin-protein3d and jbrowse-plugin-msaview, error-paging
// sessions on the deployed host until the export was restored.
//
// So removals fail here. Additions don't -- growing the ABI is safe, and making
// every new export a baseline edit would train people to regenerate on autopilot.
// To remove a name deliberately, delete it from abiBaseline.json in the same
// commit and say in the message which published plugins were checked.
describe('external plugin ABI', () => {
  const entries = Object.entries(baseline as Record<string, string[]>)

  it.each(entries)(
    '%s keeps every export plugins may have linked',
    (name, names) => {
      const mod = libs[name as keyof typeof libs] as Record<string, unknown>
      expect(mod).toBeDefined()
      const missing = names.filter(n => !(n in mod))
      expect(missing).toEqual([])
    },
  )

  it('pins every @jbrowse/core module the host actually serves', () => {
    // a new namespace re-export should get a baseline entry rather than sit
    // unguarded; modules exposing only a default export have no names to pin
    const unpinned = Object.entries(libs)
      .filter(([name]) => name.startsWith('@jbrowse/core/'))
      .filter(
        ([name, mod]) =>
          Object.keys(mod as object).length > 0 && !(name in baseline),
      )
      .map(([name]) => name)
    expect(unpinned).toEqual([])
  })
})
