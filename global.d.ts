declare module '*.css'
declare module '@fontsource/roboto'

/**
 * Test-only, installed by `config/jest/contractGate.js`. Drains the
 * `[jbrowse <family> contract]` messages reported so far and returns them —
 * which is also how a test says it provoked them on purpose, since anything
 * still in the buffer when a test ends fails that test.
 */
declare function takeContractReports(): string[]
