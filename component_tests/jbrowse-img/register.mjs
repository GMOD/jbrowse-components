// Registers resolve.mjs as an ESM resolve hook (passed via `node --import`).
// Hooks must live in a separate module from the register() call, hence the
// split between this file and resolve.mjs.
import { register } from 'node:module'

register('./resolve.mjs', import.meta.url)
