// Shoot public/static-first-paint.png from that page's own built demo:
//
//   pnpm build && pnpm capture-poster && pnpm build
//
// The whole run is `writeExamplesSitePoster` in @jbrowse/browser-test-utils.
import { writeExamplesSitePoster } from '@jbrowse/browser-test-utils'

process.exitCode = await writeExamplesSitePoster(
  import.meta.url,
  'static-first-paint',
)
