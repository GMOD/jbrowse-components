## @jbrowse/development-tools

This is a specialized rollup config that is used by our plugin-template

See https://github.com/GMOD/jbrowse-plugin-template/ for more info!

## Dev note

This package is not in the true monorepo/yarn workspace because the former dev
dependency on tsdx forced some older versions of devtools. Now that tsdx has
been removed, it may be possible to return this to the yarn workspace.

Therefore, if changes are made to this package, you must publish it separately
