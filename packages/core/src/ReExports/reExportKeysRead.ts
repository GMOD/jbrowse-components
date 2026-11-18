const READ =
  /JBrowseExports\s*(?:\[\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)\s*\]|\.\s*([A-Za-z_$][\w$]*))/g

/**
 * The `JBrowseExports` keys a plugin bundle reads, or `undefined` when its text
 * cannot say: a computed key, the global passed around whole, or `jbrequire`,
 * which reads the registry by a name the text need not spell. Every bundler a
 * plugin is built with writes an external as a literal read off the global
 * (`JBrowseExports["@jbrowse/core/util"]`, a minifier's backticks, or
 * `JBrowseExports.react`), and every store bundle reads only that way.
 */
export function reExportKeysRead(text: string) {
  const keys = new Set<string>()
  let reads = 0
  for (const m of text.matchAll(READ)) {
    const key = m[1] ?? m[2] ?? m[3] ?? m[4]
    if (key !== undefined) {
      reads += 1
      keys.add(key)
    }
  }
  const mentions = text.match(/JBrowseExports/g)?.length ?? 0
  return mentions === reads && !text.includes('jbrequire') ? keys : undefined
}
