// Registers integrationResolve.mjs as an ESM resolve hook. Passed via tsx's
// `--import` so it registers *after* tsx's own hooks — our hook then runs
// first, rewrites the bad react-transition-group specifier, and delegates the
// rest of resolution back to tsx. (`--import`-ing a file that merely exports
// `resolve` does nothing; hooks must go through module.register.)
import { register } from 'node:module'

register('./integrationResolve.mjs', import.meta.url)
