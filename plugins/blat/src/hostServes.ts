/**
 * Whether the JBrowse running this bundle provides an import, rather than
 * hostShim's stand-in for one it lacks: a function that throws when called,
 * marked `jbrowseHostMissing` (`@jbrowse/core/ReExports/hostShim`). Always
 * true for a build that bundles this plugin directly.
 */
export function hostServes(provided: object) {
  return !('jbrowseHostMissing' in provided)
}
