// A tutorial figure has to follow an instruction the reader can carry out. This
// finds the figures and clips that arrive in a section with no such instruction
// before them: no location string to type, no menu path to click, no config to
// paste, no command to run, and no sentence that opens with a click.
//
// A section is what a `##` or `###` heading opens. The instruction has to come
// before the tag inside that section, so a page that shows the result and then
// says how to get it is flagged the same as one that never says.

const LOCSTRING = /`[A-Za-z0-9_.-]+:[\d,]+-[\d,]+`/
const MENU_PATH = /\*\*[^*\n]*→[^*\n]*\*\*/
const IMPERATIVE =
  /(?:^|[.:;]\s+)(?:Click|Right-click|Left-click|Double-click|Drag|Hover|Type|Pick|Open|Choose|Take|Cut|Scroll|Press|Zoom|Turn|Apply|Add|Run|Set|Tick|Select|Switch|Enter|Paste|Load|Go|Navigate|Rubberband|Shift-click)\b/
const ACTION_FENCE =
  /^\s*(?:```|~~~)(?:json\s+(?:addtrack|addassembly|session)\b|bash\b|sh\b)/
const TAG = /<(Figure|Video)\b/
const HEADING = /^#{2,3}\s/

export interface UnpromptedTag {
  line: number
  tag: string
}

export function unpromptedTags(text: string): UnpromptedTag[] {
  const out: UnpromptedTag[] = []
  let inFence = false
  let actionSeen = false
  text.split('\n').forEach((line, i) => {
    if (/^\s*(?:```|~~~)/.test(line)) {
      if (!inFence && ACTION_FENCE.test(line)) {
        actionSeen = true
      }
      inFence = !inFence
      return
    }
    if (inFence) {
      return
    }
    if (HEADING.test(line)) {
      actionSeen = false
      return
    }
    const tag = TAG.exec(line)
    if (tag) {
      if (!actionSeen) {
        out.push({ line: i + 1, tag: tag[1]! })
      }
      return
    }
    if (LOCSTRING.test(line) || MENU_PATH.test(line) || IMPERATIVE.test(line)) {
      actionSeen = true
    }
  })
  return out
}
