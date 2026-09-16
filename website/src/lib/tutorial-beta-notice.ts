import webPackage from '../../../products/jbrowse-web/package.json'
import { currentVersion } from '../config.ts'

function notice(version: string) {
  const tag = `v${version}`
  const major = tag.split('.')[0]
  return `:::caution JBrowse ${major} beta

The tutorials target the JBrowse ${major} beta, and the ${currentVersion} release
on the [download page](/download/) lacks some of what they show. To install the
beta of JBrowse Web, run \`npm install -g @jbrowse/cli@next\`, then
\`jbrowse create jbrowse2 --branch ${tag}\`. Desktop beta builds are not out yet.

:::`
}

export const tutorialBetaNotice = webPackage.version.includes('-')
  ? notice(webPackage.version)
  : undefined
