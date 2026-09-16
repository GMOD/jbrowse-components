/**
 * Where the runtime re-export registry lands once something has actually loaded
 * a runtime plugin.
 *
 * `ReExports/modules.ts` is the ABI external plugins link against, and it
 * reaches it by spreading `import * as` namespaces of every subpath core
 * publishes into one object, as each product's `reExports.generated.ts` does
 * for every package it bundles. A namespace spread *names every export*, so
 * nothing downstream of those modules can be tree-shaken. `PluginManager` used
 * to import it
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

// A bundle built against another @jbrowse/core, or against a package this host
// does not bundle, reads a key the map lacks — at module scope, so what it then
// throws is `Cannot read properties of undefined` with no module named. A
// plugin's own build tool only ever externalizes a key `ReExports/list.ts`
// names, so every scoped-or-slashed read that misses is that case, and this
// names it. Anything else missing reads `undefined` as it always did.
export function loudOnMissingModule(libs: Record<string, unknown>) {
  return new Proxy(libs, {
    get(target, key, receiver) {
      if (
        typeof key === 'string' &&
        !(key in target) &&
        (key.startsWith('@') || key.includes('/'))
      ) {
        throw new Error(
          `This JBrowse does not serve '${key}' to plugins: the plugin was built against an older or newer @jbrowse/core, or against a package this host does not bundle`,
        )
      }
      return Reflect.get(target, key, receiver)
    },
  })
}
