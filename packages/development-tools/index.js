function createJBrowsePluginTsdxConfig(config, options, globals) {
  if (options.format === 'umd') {
    // If it's an external package in node_modules and is not in JBrowse's
    // list of re-exported packages, bundle it in the UMD build.
    const originalExternal = config.external
    config.external = (...args) => {
      const isExternal = originalExternal(...args)
      if (isExternal) {
        const id = args[0]
        if (!globals.includes(id)) {
          try {
            require.resolve(id)
            return false
            // eslint-disable-next-line no-empty
          } catch {}
        }
      }
      return isExternal
    }
    // Let rollup know the global name of each JBrowse re-exported package
    globals.forEach(global => {
      config.output.globals[global] = `JBrowseExports.${global}`
    })

    // xref https://github.com/rollup/rollup/issues/2616 we use code splitting
    // but plugins want single file output
  }
  config.inlineDynamicImports = true
  return config
}

exports.createJBrowsePluginTsdxConfig = createJBrowsePluginTsdxConfig
