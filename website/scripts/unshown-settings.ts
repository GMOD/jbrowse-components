// The mirror of `figure-actions.ts`. That one finds a figure nobody was told
// how to reach; this one finds the instruction whose result nobody is shown.
//
// A display setting is a visual claim: `Color by... → Modifications` paints
// something, `Cluster rows by similarity` reorders something. Writing the path
// and no figure asks the reader to picture the result, which is the one thing a
// tutorial can do for them.
//
// The figure may land in the setting's own section or in the one after it,
// because a page that sets up a display and then opens `## Reading the plot`
// with the picture is following the house order rather than breaking it.
//
// Two menu paths are excluded, and neither draws anything: `File → ...` opens a
// session or a file, and `Global plugins...` installs a plugin. What either
// produces is whatever the next instruction then shows.

// The figure has to come AFTER the setting. A page whose section shows a
// picture and then names a setting has shown something else: `dog10k_lof`
// draws copy number and then, thirty lines on, says to cluster the rows.
const MENU_PATH =
  /\*\*[^*\n]*→[^*\n]*\*\*|\*\*[^*\n]+\*\*\s*→\s*\*\*[^*\n]+\*\*/
const PLUMBING =
  /\*\*File\s*→|Global plugins|Add custom plugin|Open JBrowse Web link/
const TAG = /<(Figure|Video)\b/
const HEADING = /^#{2,3}\s/
const TAIL = /^##\s+(See also|References)/

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
  for (const [i, line] of lines.entries()) {
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
    if (MENU_PATH.test(line) && !PLUMBING.test(line)) {
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
