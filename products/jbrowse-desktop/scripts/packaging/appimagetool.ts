// The appimagetool build the Linux release is pinned to.
//
// MACHINE-EDITED. `pnpm update:appimagetool [version]` rewrites the two
// constants below after downloading the asset, hashing it, and checking it
// runs. Editing them by hand works too, but the script is what makes sure the
// hash matches the version rather than the last one.
//
// A tagged release, not the rolling `continuous` tag this used to pull.
// `continuous` is rebuilt in place, so every Linux release was built by whatever
// happened to be behind that URL that day, unverified — a changed upstream build
// either breaks the release or silently alters the artifact, and nothing here
// would notice either. Vendoring it was considered: the binary is 15MB, which is
// 15MB in git forever, per bump, for a file that then never receives a security
// update. A pin plus a checksum buys the same reproducibility and none of that.

export const APPIMAGETOOL_VERSION = '1.9.1'
export const APPIMAGETOOL_SHA256 =
  'ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0'

export function appimagetoolUrl(version = APPIMAGETOOL_VERSION) {
  return `https://github.com/AppImage/appimagetool/releases/download/${version}/appimagetool-x86_64.AppImage`
}
