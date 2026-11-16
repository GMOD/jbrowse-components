// The node:test equivalent of bin.ts's resolve hooks. Same two rewrites, from
// the same source — see src/resolve.ts for what they do and why. Only the hook
// signature differs: the loader thread's `nextResolve` is async.
//
// The helpers come from src, which Node strips as it loads them, so an edit to
// resolve.ts reaches these tests without a rebuild. `pnpm build` at the repo
// root is a prerequisite of these tests regardless — builtUrl throws without
// it.
import { builtUrl, staleEsmImport, transitionGroup } from './resolve.ts'

export async function resolve(specifier, context, nextResolve) {
  let resolved
  try {
    resolved = await nextResolve(transitionGroup(specifier), context)
  } catch (e) {
    throw staleEsmImport(specifier, context.parentURL) ?? e
  }
  const built = builtUrl(resolved.url)
  return built ? { ...resolved, url: built } : resolved
}
