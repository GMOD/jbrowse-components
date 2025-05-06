import modules from './modules'

/**
 * Used by plugin build systems to determine if a module is provided by JBrowse
 * globally and thus doesn't need to be bundled. A check in ./modules.tsx makes
 * sure this is in sync with the re-exported modules.
 */
export default Object.keys(modules)
