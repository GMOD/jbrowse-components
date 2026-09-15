import fs from 'node:fs'
import path from 'node:path'

/**
 * The Windows installer's usage-reporting checkbox, as a file.
 *
 * SignPath's terms require an installation option to turn off the anonymous
 * usage report the privacy policy describes, so the installer shows one and
 * writes this file next to the app when the box is cleared. The app only reads
 * it: $INSTDIR is the directory the installer knows, and the uninstaller takes
 * this with the rest of it.
 *
 * Separate from the `disableAnalytics` config slot, which travels with a config
 * or a session file — a choice made at install time has to hold whatever the
 * user opens afterwards.
 *
 * Its own module, importing no electron, so the packaging scripts can name the
 * file the installer writes. Same reason launchTarget.ts is separate from
 * paths.ts.
 */
export const ANALYTICS_OPT_OUT_FILE = 'analytics-opt-out'

export function analyticsOptedOut(resourcesPath: string) {
  return fs.existsSync(path.join(resourcesPath, ANALYTICS_OPT_OUT_FILE))
}
