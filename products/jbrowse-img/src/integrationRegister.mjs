// Registers integrationResolve.mjs as an ESM resolve hook. Passed via node's
// `--import` so it is in place before the test files pull in the module graph.
// (`--import`-ing a file that merely exports `resolve` does nothing; hooks must
// go through module.register.)
import { register } from 'node:module'

register('./integrationResolve.mjs', import.meta.url)
