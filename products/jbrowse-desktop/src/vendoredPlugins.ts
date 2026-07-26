/**
 * Plugins this product bundles that the shared `vendoredPluginNames` list does
 * not name, because another product does not bundle them.
 *
 * Blat is in Desktop's corePlugins but deliberately not Web's — Web is where
 * cold-load bundle size is paid, and BLAT is niche, so Web gets it from a
 * config's `plugins[]` entry instead. jb2hubs stamps that entry into every hub
 * config, which both products then open: Web has to load it, and Desktop has to
 * ignore it, or the plugin is installed twice and appends its Tools menu items
 * twice.
 *
 * Keeping Desktop's copy bundled rather than dropping it from corePlugins is
 * deliberate: it is what gives BLAT on a genome the user opened from their own
 * disk, where no config names any plugin, and it is the copy that reaches UCSC
 * through the main-process `blatFetch` bridge and the CAPTCHA-solve window.
 */
export const DESKTOP_VENDORED = ['Blat']
