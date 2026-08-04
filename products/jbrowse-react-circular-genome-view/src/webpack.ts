// The UMD entry point: everything the npm entry exports, plus React itself,
// since a <script>-tag consumer can't import it. Re-exported wholesale rather
// than hand-listed, which is how the sibling products' lists drifted.
// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

export * from './index.ts'

export * from 'react-dom/client'

export { React }
