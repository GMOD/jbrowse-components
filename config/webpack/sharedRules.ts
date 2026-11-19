import browserslist from 'browserslist'

// What the web and desktop apps and the UMD bundles all compile with: the
// root babel.config.cjs (`rootMode: 'upward'`), so they run the React Compiler
// and preset-env exactly as jest does.

export const resolveExtensions = ['.mjs', '.js', '.ts', '.tsx', '.jsx', '.json']

export function sharedRules(mode: 'production' | 'development') {
  // With `rootMode: 'upward'` babel looks for a browserslist from the repo
  // root, which has none, so the product's own list is passed in as `targets`.
  const targets = browserslist.loadConfig({ path: process.cwd(), env: mode })
  return [
    {
      // MUI v9 and other ESM deps ship .mjs files with extensionless
      // subpath imports (e.g. react-transition-group/TransitionGroupContext);
      // webpack 5 treats .mjs as fully specified and rejects them otherwise
      test: /\.m?js$/,
      resolve: { fullySpecified: false },
    },
    {
      test: /\.m?[tj]sx?$/,
      exclude: /node_modules/,
      loader: 'babel-loader',
      // Babel's own envName defaults independently of webpack's `mode`
      // (falls back to 'development' when NODE_ENV is unset) — pin it to
      // `mode` so @babel/preset-react's automatic runtime can't pick the dev
      // jsxDEV transform while webpack bundles the production react runtime
      // (which has no jsxDEV export), a mismatch that crashes at runtime.
      options: {
        rootMode: 'upward',
        envName: mode,
        ...(targets ? { targets } : {}),
      },
    },
  ]
}
