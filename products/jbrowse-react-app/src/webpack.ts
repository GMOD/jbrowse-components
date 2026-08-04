// The UMD entry point: everything the npm entry exports, plus the stylesheet
// and React itself, since a <script>-tag consumer can't import either.
//
// Re-exported wholesale rather than hand-listed. The list drifted while it was
// hand-written — `createApp`, the very API that exists for the script-tag
// consumer this bundle serves, was missing from it.
import 'dockview-react/dist/styles/dockview.css'

// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

export * from './index.ts'

export * from 'react-dom/client'

export { React }
