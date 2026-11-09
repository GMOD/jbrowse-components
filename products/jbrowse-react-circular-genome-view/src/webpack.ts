// The UMD entry point: everything the npm entry exports, plus React itself,
// since a <script>-tag consumer can't import it. Re-exported wholesale rather
// than hand-listed, which is how the sibling products' lists drifted.
//
// The cost of `export *` is that a name exported by both sides is silently
// dropped from the bundle rather than reported. Today the only candidate is
// `version` (react-dom/client has one, and so does ./version.ts), which the npm
// entry point below does not re-export — so if you ever add it there, re-export
// it under a distinct name here.
// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

export * from './index.ts'

export * from 'react-dom/client'

export { React }
