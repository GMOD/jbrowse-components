// Published as `@jbrowse/core/ReExports/hostShim` for a plugin's esbuild
// config. Like every `/ReExports/` subpath it is never served at runtime.
import list from './list.ts'
import installedNames from './names.generated.ts'

/** The export names a host serves under each specifier. `[]` serves it whole. */
export type HostNames = Record<string, readonly string[]>

interface HostShimBuild {
  initialOptions: { logOverride?: Record<string, string> }
  onResolve(
    options: { filter: RegExp },
    callback: (args: { path: string }) => {
      path: string
      namespace: string
      sideEffects: boolean
    },
  ): void
  onLoad(
    options: { filter: RegExp; namespace: string },
    callback: (args: {
      path: string
    }) => { contents: string } | { errors: { text: string }[] },
  ): void
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/**
 * The module a bundle gets in place of one host specifier. Each name the host
 * serves becomes a named export, so importing a name it does not serve fails
 * the build. A host that lacks one at runtime hands back a function that
 * throws naming the export, where `undefined` rendered as a component is React
 * error #130.
 */
export function shimSource(
  key: string,
  names: readonly string[],
  pluginName: string,
) {
  const hostKey = JSON.stringify(key)
  if (names.length === 0) {
    return `module.exports = JBrowseExports[${hostKey}]`
  }
  const message = JSON.stringify(
    `${pluginName} was built for a different JBrowse version, so update the plugin or JBrowse`,
  )
  return [
    `const host = JBrowseExports[${hostKey}]`,
    `const read = name =>`,
    `  host != null && name in Object(host)`,
    `    ? host[name]`,
    `    : Object.assign(`,
    `        function () {`,
    `          throw new Error("This JBrowse does not provide '" + name + "' from '" + ${hostKey} + "' to plugins: " + ${message})`,
    `        },`,
    `        { jbrowseHostMissing: name },`,
    `      )`,
    ...names
      .filter(n => n !== 'default' && IDENTIFIER.test(n))
      .map(
        n => `export const ${n} = /* @__PURE__ */ read(${JSON.stringify(n)})`,
      ),
    `export default host && host.__esModule ? host.default : host`,
  ].join('\n')
}

/**
 * The esbuild plugin that binds a runtime plugin's imports of the host's
 * singletons and `@jbrowse` subpaths to what the running JBrowse serves on
 * `JBrowseExports`, so the bundle reuses the host's React, MobX and
 * `@jbrowse/core` rather than carrying a second copy.
 *
 * `names` defaults to what the installed `@jbrowse/core` serves, which makes
 * that version the oldest host the plugin supports. Pass another host's, from
 * `fetchHostNames`, to find an import a newer host dropped.
 */
export function hostShim({
  pluginName,
  names = installedNames,
  host = 'the installed @jbrowse/core',
}: {
  pluginName: string
  names?: HostNames
  host?: string
}) {
  const filter = new RegExp(
    `^(${list.map(k => k.replaceAll(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})$`,
  )
  return {
    name: 'jbrowse-host-shim',
    setup(build: HostShimBuild) {
      // `ns.name` off `import * as ns` is only a warning when the host serves
      // no `name`, and the bundle reads undefined there at runtime
      build.initialOptions.logOverride = {
        'import-is-undefined': 'error',
        ...build.initialOptions.logOverride,
      }
      build.onResolve({ filter }, ({ path }) => ({
        path,
        namespace: 'jbrowse-host',
        sideEffects: false,
      }))
      build.onLoad({ filter: /.*/, namespace: 'jbrowse-host' }, ({ path }) => {
        const served = names[path]
        return served
          ? { contents: shimSource(path, served, pluginName) }
          : {
              errors: [{ text: `${host} does not serve '${path}' to plugins` }],
            }
      })
    },
  }
}

const MANIFEST = 'packages/core/src/ReExports/reExports.generated.json'

/** What a jbrowse-components tag or branch serves to plugins, from GitHub. */
export async function fetchHostNames(ref: string): Promise<HostNames> {
  const url = `https://raw.githubusercontent.com/GMOD/jbrowse-components/${ref}/${MANIFEST}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`)
  }
  const { framework, modules } = (await res.json()) as {
    framework: HostNames
    modules: Record<string, { names: string[] }>
  }
  return {
    ...framework,
    ...Object.fromEntries(
      Object.entries(modules).map(([key, { names }]) => [key, names]),
    ),
  }
}
