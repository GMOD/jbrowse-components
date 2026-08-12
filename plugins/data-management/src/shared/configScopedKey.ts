// Identifies the loaded config (page path + ?config= param) so localStorage
// settings can be scoped per-config rather than bleeding across datasets.
export function keyConfigPostFix() {
  return typeof window !== 'undefined'
    ? [
        window.location.pathname,
        new URLSearchParams(window.location.search).get('config'),
      ]
        .filter(Boolean)
        .join('-')
    : 'empty'
}

// Builds a localStorage key scoped to the loaded config and the given
// assemblies, so per-dataset settings (hidden columns, widths, ...) don't leak
// between different configs that happen to share column names.
//
// The near-twin is core's `instanceScopedKey` (ui/useAssemblySelection.ts), and
// the two must NOT be merged even though they are the same idea. They disagree
// on every detail that reaches the output: this one omits the host, filters
// empty parts out, and answers `'empty'` off-window; that one includes the
// host, joins unfiltered (so a page with no `?config=` genuinely stores a
// literal `null` segment) and assumes a browser. So a "cleanup" that unified
// them would re-key every stored setting on both sides at once — hidden columns
// and widths here, remembered assembly and recent locations there — and every
// user would find their settings silently back at the defaults. Touch either
// spelling only as a deliberate migration.
export function configScopedKey(name: string, assemblyNames: string[]) {
  return [name, keyConfigPostFix(), assemblyNames.join(',')]
    .filter(Boolean)
    .join('-')
}
