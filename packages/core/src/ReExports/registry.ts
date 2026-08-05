/**
 * Where the runtime re-export registry lands once something has actually loaded
 * a runtime plugin.
 *
 * `ReExports/modules.ts` is the ABI external plugins link against, and it
 * reaches it by spreading `import * as` namespaces of `@jbrowse/core/ui`,
 * `configuration`, `util` and a dozen more into one object. A namespace spread
 * *names every export*, so nothing downstream of those barrels can be
 * tree-shaken — and the module also throws at top level if `libs` and `list.ts`
 * disagree, so it cannot be dropped either. `PluginManager` used to import it
 * statically for `jbrequire`, which put the whole surface — most of
 * `@jbrowse/core/ui` and, behind it, ~400 KB of Material UI — into the eager
 * first-paint graph of **every** host, including embedded ones that load no
 * runtime plugin at all. Measured on `products/jbrowse-build-your-own`'s
 * examples site: 128 fewer eager chunks, 299 KB raw / 126 KB gzipped.
 *
 * Nothing can call `jbrequire` before a runtime plugin exists, and the only way
 * one exists is `PluginLoader.load()`, which is async — so the registry is
 * imported there and parked here for the synchronous `jbrequire` to find. This
 * module deliberately imports nothing, so holding the slot costs no graph.
 */
let registry: Record<string, unknown> = {}

export function setReExportRegistry(libs: Record<string, unknown>) {
  registry = libs
}

export function getReExportRegistry() {
  return registry
}
