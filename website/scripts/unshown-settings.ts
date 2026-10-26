// The mirror of `figure-actions.ts`. That one finds a figure nobody was told
// how to reach; this one finds the instruction whose result nobody is shown.
//
// A display setting makes a visual claim. `Color by → Modifications` paints
// the reads and `Cluster rows by similarity` reorders them, so a path written
// with no figure under it leaves the reader to imagine the result.
//
// The figure may land in the setting's own section or in the one after it,
// because a page that sets up a display and then opens `## Reading the plot`
// with the picture is following the house order rather than breaking it.
//
// Some menu paths are excluded because none draws anything: `File → ...` opens a
// session or a file, and `Global plugins...` (Desktop) or `Tools → Plugin
// store` (Web) installs a plugin. What each produces is whatever the next
// instruction then shows.

// The opening's list of what the page does names settings ahead of the
// sections that use them, so a path before the first heading is not counted.

// The figure has to come AFTER the setting. A page whose section shows a
// picture and then names a setting has shown something else: `dog10k_lof`
// draws copy number and then, thirty lines on, says to cluster the rows.
//
// That direction has one false positive, and the list keeps it. A section can
// show one figure and then walk its lanes, naming under each the setting that
// built it. `dog10k_lof` does that, and its clustered lane is already in the
// frame above the sentence. **Don't shoot a second figure for one of these.**
// Where a page is worth repairing at all, name the setting before the figure it
// produced.
import { unwrapBold } from './unwrap-bold.ts'

const MENU_PATH =
  /\*\*[^*\n]*→[^*\n]*\*\*|\*\*[^*\n]+\*\*\s*→\s*\*\*[^*\n]+\*\*/
const PLUMBING =
  /\*\*File\s*→|Global plugins|Add custom plugin|Plugin store|Open JBrowse Web link/
const TAG = /<(Figure|Video)\b/
const HEADING = /^#{2,3}\s/
const TAIL = /^##\s+(See also|External links|Citations)/

export interface UnshownSetting {
  line: number
  path: string
}

export function unshownSettings(text: string): UnshownSetting[] {
  const lines = text.split('\n')
  const sections: { start: number }[] = []
  const media: number[] = []
  const found: { line: number; path: string; section: number }[] = []
  let inFence = false
  let section = -1
  for (const { line: i, text: line } of unwrapBold(text)) {
    if (TAIL.test(line)) {
      break
    }
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }
    if (HEADING.test(line)) {
      sections.push({ start: i })
      section = sections.length - 1
      continue
    }
    if (TAG.test(line)) {
      media.push(i)
      continue
    }
    if (section >= 0 && MENU_PATH.test(line) && !PLUMBING.test(line)) {
      found.push({
        line: i + 1,
        path: MENU_PATH.exec(line)![0].replaceAll('*', ''),
        section,
      })
    }
  }
  // Past the setting, and no further than where the section after its own ends.
  const horizon = (n: number) => sections[n + 2]?.start ?? lines.length
  return found
    .filter(f => !media.some(m => m > f.line && m < horizon(f.section)))
    .map(({ line, path }) => ({ line, path }))
}
