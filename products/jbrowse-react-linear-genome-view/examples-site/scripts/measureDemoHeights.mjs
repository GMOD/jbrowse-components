// Write the height each demo settles at, which src/siteMeta.ts reserves on its
// box so the page doesn't jump when the island mounts:
//
//   pnpm build && pnpm measure-demo-heights && pnpm build
//
// The whole run is `writeExamplesSiteDemoHeights` in
// @jbrowse/browser-test-utils — what stays here is the anchor, since node
// resolves a module's relative paths from its real location and only the call
// site knows which site is calling.
import { writeExamplesSiteDemoHeights } from '@jbrowse/browser-test-utils'

await writeExamplesSiteDemoHeights(import.meta.url)
