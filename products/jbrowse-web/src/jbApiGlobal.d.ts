import type { JbApi } from '@jbrowse/app-core'

// Typed, unlike the `unknown` MST pair in declare.d.ts beside it: that pair is
// walked, and deliberately not frozen into a declared shape, while this one is
// CALLED — so its signatures are the whole point of publishing it. Assigned in
// components/JBrowse.tsx; the same object desktop serves to MCP.
//
// Its own file because naming the type needs an import, and an import in
// declare.d.ts would make that file a module.
declare global {
  interface Window {
    jb?: JbApi
  }
}
