// eslint-disable-next-line no-undef
module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    plugins: ['babel-plugin-react-compiler'],
    presets: [
      [
        '@babel/preset-react',
        {
          runtime: 'automatic',
        },
      ],
      '@babel/preset-env',
      '@babel/preset-typescript',
    ],
    ignore: [
      // Ignore node_modules EXCEPT react-msaview and its ESM-only deps, which
      // ship untranspiled ESM and must be run through babel (jest can't parse
      // them otherwise). The negative lookahead matches these package names
      // anywhere in the pnpm path.
      /node_modules\/(?!.*(?:react-msaview|msa-parsers|@jbrowse[+/]svgcanvas|flatbush|flatqueue|colord))/,
      './packages/*/node_modules',
      './products/*/node_modules',
      './plugins/*/node_modules',
      './demos/*/node_modules',
    ],
  }
}
