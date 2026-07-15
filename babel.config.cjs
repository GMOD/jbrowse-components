// eslint-disable-next-line no-undef
module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    // WARNING: babel-plugin-react-compiler runs on EVERY component, including
    // mobx `observer`s. It can silently drop a mobx in-place update when an
    // observer reads `model.<scalar>` inside a CONDITIONAL (ternary, `&&`, or a
    // nested conditional) AND passes `model` whole to a child in that same block
    // — the compiler coarsens the memo dep to `model` identity, which mobx
    // in-place mutation never invalidates. It only bites `model`-like STABLE
    // identity (MST nodes mutated in place); plain props recreated on change are
    // safe. Fix = pull the read out of the conditional (e.g. literal
    // early-`return`). Full analysis + minimal repro + why it's not upstreamable:
    // agent-docs/COMPILER_TERNARY_FINDING.md (kept in sync with DisplayChrome.tsx
    // and ARCHITECTURE.md §1a).
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
