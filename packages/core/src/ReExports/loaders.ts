// The runtime plugin ABI @jbrowse/core alone can serve on the main thread, one
// import() per key, for a product's registry scan (ADR-274). Same keys as
// modules.ts.
import loaders from './coreLoaders.generated.ts'

export default loaders
