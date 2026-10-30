// The gate itself is `@jbrowse/display-kit/conformance/contractGate`, so a
// plugin repo runs the same one. The families it listens for are listed in
// `agent-docs/reference/ARCHITECTURAL_LIMITS.md` §"Ordering is the contract".
//
// Installed after `console.js` (setupFiles), so it wraps that filter: a
// contract report is buffered here before any filter could drop it.
import {
  installContractGate,
  takeContractReports,
} from '../../packages/display-kit/src/conformance/contractGate.ts'

installContractGate({ afterEach, afterAll })
globalThis.takeContractReports = takeContractReports
