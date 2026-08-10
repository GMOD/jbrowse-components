/**
 * Plugins this product bundles that the shared `vendoredPluginNames` list does
 * not name, because another product does not bundle them.
 *
 * Blat is in Desktop's corePlugins but deliberately not Web's — Web is where
 * cold-load bundle size is paid, and BLAT is niche. So Desktop's bundled copy is
 * the only one that ships: it is what gives BLAT on a genome the user opened
 * from their own disk, where no config names any plugin, and it is the copy that
 * reaches UCSC through the main-process `blatFetch` bridge and the CAPTCHA-solve
 * window.
 *
 * Naming it here drops a config's `plugins[]` entry for Blat before the loader
 * sees it, so a config that carries one does not install a second copy beside
 * the bundled one and append its Tools menu items twice. Nothing carries one
 * today: jb2hubs stamps `sequence.metadata.blatDb`, which names the UCSC db an
 * assembly is searchable under and says nothing about loading a plugin. The
 * entry is a guard for the UMD build (`plugins/blat/scripts/build-umd.ts`),
 * which a config can name and which is how Web would pick BLAT up.
 */
export const DESKTOP_VENDORED = ['Blat']
