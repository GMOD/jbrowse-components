const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { join, relative } = require('node:path')

const transformer = require('babel-jest').default.createTransformer({
  rootMode: 'upward',
})

// The cache key, ours, and the reason is that babel-jest's costs more than the
// transform it guards. Its `getCacheKey` calls `loadPartialConfigSync` — a full
// babel config resolution, walking up from the file for `rootMode: 'upward'` —
// for every module it is asked about. Measured on one warm jbrowse-web suite:
// 2028 calls, 897ms of a 12.2s run, and zero actual transforms.
//
// Jest asks once per module per worker PROCESS, not per test file, which is
// what sizes this: a worker that ran 40 jbrowse-web suites made ~2000 calls in
// total, not 2000 apiece. So the saving is per worker rather than the ~1.18M
// calls a per-suite reading of the same measurement predicts.
//
// What a key has to separate is what babel would compile differently. Content
// and path are the per-file half; the rest is one fingerprint computed once:
//
// - `babel.config.cjs` verbatim, since it IS the config (there is no other
//   babel config in the tree — `rootMode: 'upward'` finds this one and stops).
// - `pnpm-lock.yaml`, which moves whenever a preset, a plugin or babel itself
//   does. Coarse on purpose: a dependency bump invalidating the whole cache is
//   what the CI cache key already does (`push.yml` keys on this file), and it
//   is the version that cannot silently serve output from an older compiler.
// - `NO_RC`, the one env var `babel.config.cjs` branches on — it drops
//   babel-plugin-react-compiler, so the same source compiles two ways.
//
// The per-file path is RELATIVE to rootDir, and nothing absolute enters the
// key. That is deliberate: entries are then valid in any checkout, so the
// `cacheDirectory` can be shared and an agent worktree starts warm instead of
// paying the whole cold transform again.
function fingerprint() {
  const root = join(__dirname, '..', '..')
  const read = f => {
    try {
      return readFileSync(join(root, f))
    } catch {
      return f
    }
  }
  return (
    createHash('sha1')
      // This file, for the same reason babel-jest hashes its own: the key
      // function IS part of what the entry means, so editing it — dropping a
      // field from the hash, say — has to invalidate what the old one wrote
      // rather than let a stale entry answer to a key it no longer earns.
      .update(readFileSync(__filename))
      .update('\0')
      .update(read('babel.config.cjs'))
      .update('\0')
      .update(read('pnpm-lock.yaml'))
      .update('\0')
      .update(process.env.NO_RC ?? '')
      .update('\0')
      .update(process.env.BABEL_ENV ?? process.env.NODE_ENV ?? '')
      .update('\0')
      .update(process.version)
      .digest('hex')
  )
}

const CONFIG_KEY = fingerprint()

// The caller flags babel-jest passes to babel decide whether ESM survives, so
// two runs that disagree on them must not share an entry.
const CALLER_FLAGS = [
  'supportsDynamicImport',
  'supportsExportNamespaceFrom',
  'supportsStaticESM',
  'supportsTopLevelAwait',
]

function cacheKey(sourceText, sourcePath, options) {
  const hash = createHash('sha1')
    .update(CONFIG_KEY)
    .update('\0')
    .update(relative(options.config.rootDir, sourcePath))
    .update('\0')
    .update(sourceText)
    .update('\0')
    .update(options.instrument ? 'instrument' : '')
  for (const flag of CALLER_FLAGS) {
    hash.update('\0').update(options[flag] ? '1' : '0')
  }
  return hash.digest('hex').slice(0, 32)
}

module.exports = {
  ...transformer,
  getCacheKey: cacheKey,
  getCacheKeyAsync: async (...args) => cacheKey(...args),
}
