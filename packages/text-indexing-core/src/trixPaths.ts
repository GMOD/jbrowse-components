import path from 'node:path'

/** Every trix artifact lands in this directory under the output directory. */
export const TRIX_DIR = 'trix'

// Windows reserves these device names even with an extension, so a track or
// assembly literally named e.g. NUL would otherwise yield an unusable NUL.ix
const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

// makes `name` safe as a filename on Windows: replaces the invalid characters
// \ / : * ? " < > |, drops trailing dots/spaces (Windows silently strips them),
// and escapes reserved device names
export function sanitizeForFilename(name: string) {
  const cleaned = name
    .replaceAll(/[\\/:*?"<>|]/g, '_')
    .replace(/(?<![. ])[. ]+$/, '')
  return windowsReservedName.test(cleaned) ? `_${cleaned}` : cleaned
}

/**
 * The three files an index called `name` writes, sanitized once.
 *
 * Everything that writes a trix artifact or points a config at one derives its
 * paths from here. They used to sanitize independently and one of them didn't:
 * the CLI wrote `.ix`/`.ixx` under the raw name while `generateMeta` and
 * `createTrixAdapter` sanitized, so a trackId holding a `/` aimed the write at
 * a `trix/` subdirectory that does not exist, and the rest of the
 * Windows-invalid set wrote a file no search would look for.
 */
export function trixFileNames(name: string) {
  const safeName = sanitizeForFilename(name)
  return {
    ix: `${safeName}.ix`,
    ixx: `${safeName}.ixx`,
    meta: `${safeName}_meta.json`,
  }
}

/** {@link trixFileNames} as filesystem paths under `outDir`, for a writer. */
export function trixFilePaths(outDir: string, name: string) {
  const names = trixFileNames(name)
  return {
    ix: path.join(outDir, TRIX_DIR, names.ix),
    ixx: path.join(outDir, TRIX_DIR, names.ixx),
    meta: path.join(outDir, TRIX_DIR, names.meta),
  }
}

/**
 * {@link trixFileNames} as URIs relative to the config, for an adapter conf.
 * Always `/`-joined — a URI is not a filesystem path, so this one does not go
 * through `path.join`, which would emit `\` on Windows.
 */
export function trixFileUris(name: string) {
  const names = trixFileNames(name)
  return {
    ix: `${TRIX_DIR}/${names.ix}`,
    ixx: `${TRIX_DIR}/${names.ixx}`,
    meta: `${TRIX_DIR}/${names.meta}`,
  }
}
