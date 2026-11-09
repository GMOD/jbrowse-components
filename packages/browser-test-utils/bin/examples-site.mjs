// `check-links | measure-demo-heights | capture-poster <slug>`, called from an
// examples-site's package.json scripts. pnpm runs a script in its package's
// directory, so the working directory is the site to act on. The scripts name
// this file by its path rather than as a package bin, because pnpm does not
// relink a workspace package's new bin on an install it calls up to date.
import {
  checkExamplesSiteDocLinks,
  writeExamplesSiteDemoHeights,
  writeExamplesSitePoster,
} from '../src/examplesSiteCli.ts'

const [command, slug = ''] = process.argv.slice(2)
const site = process.cwd()
const commands = {
  'check-links': () => checkExamplesSiteDocLinks(site),
  'measure-demo-heights': () => writeExamplesSiteDemoHeights(site),
  'capture-poster': () => writeExamplesSitePoster(site, slug),
}
const run = commands[command]
if (run) {
  process.exitCode = await run()
} else {
  console.error(
    `usage: examples-site.mjs ${Object.keys(commands).join(' | ')} [slug]`,
  )
  process.exitCode = 1
}
