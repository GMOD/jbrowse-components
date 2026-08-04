// The UMD entry point: everything the npm entry exports, plus React itself,
// since a <script>-tag consumer can't import it.
//
// Re-exported wholesale rather than hand-listed. The list drifted while it was
// hand-written — `createLinearGenomeView`, the very API that exists for the
// script-tag consumer this bundle serves, was missing from it.
// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

export * from './index.ts'

export * from 'react-dom/client'

export { React }
