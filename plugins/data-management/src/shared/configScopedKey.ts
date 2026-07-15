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
export function configScopedKey(name: string, assemblyNames: string[]) {
  return [name, keyConfigPostFix(), assemblyNames.join(',')]
    .filter(Boolean)
    .join('-')
}
