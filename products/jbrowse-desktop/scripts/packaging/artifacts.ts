// The exact files each platform's packager writes into dist/, and the only
// files publish.ts uploads to the GitHub release.
//
// One source of truth, imported by both sides: linux.ts, mac.ts and windows.ts
// name what they create from here, and publish.ts requires every one of those
// names to exist before it uploads anything. It used to be a set of extension
// and `-<platform>` patterns applied to whatever happened to be sitting in
// dist/, which had two failure modes that produced no symptom at all — renaming
// an artifact stopped it matching, so it silently wasn't uploaded, and a
// packaging step that produced nothing left a shorter upload that still exited
// 0. Both surface as a release someone downloads and finds incomplete.
//
// dist/ holds more than artifacts (the NSIS script, the AppDir, the unpacked
// electron tree are staged there), so naming what to take is also what keeps
// those out — rather than a pattern that happens not to match them.
//
// Its own module, importing config.ts for the type only, because config.ts
// reads import.meta.dirname and publish.ts calls main() at module scope: either
// one makes this untestable from where it used to live.
import type { Platform } from './config.ts'

export interface AppRelease {
  appName: string
  version: string
}

const base = ({ appName, version }: AppRelease) => `${appName}-v${version}`

// `manifest` is the electron-updater feed for the platform. A release missing
// one stops updating that platform silently — the app polls, 404s, and says
// nothing — so it is part of the artifact set, not an extra.
export const linuxArtifacts = (app: AppRelease) => ({
  appImage: `${base(app)}-linux.AppImage`,
  manifest: 'latest-linux.yml',
})

export const macArtifacts = (app: AppRelease) => ({
  dmg: `${base(app)}-mac.dmg`,
  // What Squirrel.Mac actually updates from; the dmg is the human download.
  zip: `${base(app)}-mac.zip`,
  manifest: 'latest-mac.yml',
})

export const winArtifacts = (app: AppRelease) => ({
  exe: `${base(app)}-win.exe`,
  // Unsuffixed, unlike the other two: that is the name electron-updater looks
  // for on Windows.
  manifest: 'latest.yml',
})

// Record<Platform, …> rather than a switch or an if-chain: adding a member to
// `Platform` fails to compile here, instead of yielding a release that quietly
// ships without that platform.
const BY_PLATFORM: Record<
  Platform,
  (app: AppRelease) => Record<string, string>
> = {
  linux: linuxArtifacts,
  mac: macArtifacts,
  win: winArtifacts,
}

// Every file a `--publish` run for these platforms must find in dist/.
export function releaseArtifacts(platforms: Platform[], app: AppRelease) {
  return platforms.flatMap(platform =>
    Object.values(BY_PLATFORM[platform](app)),
  )
}
