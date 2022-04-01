# Build notes

This package is built with webpack for the UMD bundles and tsc for the cjs and
esm modules

Webpack is needed for the UMD bundles because of the dynamically constructed
path of async import in PluginLoader, and the webpackIgnore is the only way
that the bundler works on this (not aware of similar option for rollup)

The tsc generates two builds one with --target es2018 for esm build and one
with --target es5 for cjs build

The esm build is especially nice for consumers of this module via e.g. their
own create-react-app

The es5 build is especially nice for consumers running via nodejs e.g.
jbrowse/img since esm support under node.js is awkward
