import PluginManagerWithoutReExports from './PluginManagerWithoutReExports'
import ReExports from './ReExports'

type AnyFunction = (...args: any) => any

export default class PluginManager extends PluginManagerWithoutReExports {
  jbrequireCache = new Map()

  lib = ReExports

  load = <FTYPE extends AnyFunction>(lib: FTYPE): ReturnType<FTYPE> => {
    if (!this.jbrequireCache.has(lib)) {
      this.jbrequireCache.set(lib, lib(this))
    }
    return this.jbrequireCache.get(lib)
  }

  /**
   * Get the re-exported version of the given package name.
   * Throws an error if the package is not re-exported by the plugin manager.
   *
   * @returns the library's default export
   */
  jbrequire = (
    lib: keyof typeof ReExports | AnyFunction | { default: AnyFunction },
  ): any => {
    if (typeof lib === 'string') {
      const pack = this.lib[lib]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!pack) {
        throw new TypeError(
          `No jbrequire re-export defined for package '${lib}'. If this package must be shared between plugins, add it to ReExports.js. If it does not need to be shared, just import it normally.`,
        )
      }
      return pack
    }

    if (typeof lib === 'function') {
      return this.load(lib)
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (lib.default) {
      return this.jbrequire(lib.default)
    }

    throw new TypeError(
      'lib passed to jbrequire must be either a string or a function',
    )
  }
}
