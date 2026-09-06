// The macOS window-server bits recordDemoMac.mjs needs: find a window, place
// it, and talk to AppleScript. Capture itself is windowCamera.mjs.
//
// **`screencapture -l <windowid>`, never `-R <region>`.** Window capture
// returns a clean, shadow-free image of a window on any Mission Control space;
// region capture only sees the space the harness happens to run on, and off it
// returns a picture of the desktop.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname)

// build output, compiled on demand rather than committed: a stale binary is
// worse than a two-second build
export function helper(name) {
  const bin = path.join(HERE, name)
  if (!fs.existsSync(bin)) {
    execFileSync(
      'swiftc',
      ['-O', path.join(HERE, `${name}.swift`), '-o', bin],
      {
        stdio: 'inherit',
      },
    )
  }
  return bin
}

export const osa = script =>
  execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).trim()

export function windowList() {
  const out = execFileSync(helper('windowlist'), { encoding: 'utf8' })
  return out
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [id, onscreen, bounds, owner, title = ''] = line.split('\t')
      const [x, y, w, h] = bounds.split(',').map(Number)
      return { id, onscreen: onscreen === 'on ', x, y, w, h, owner, title }
    })
}

export function findWindow({ owner, titleIncludes, minWidth = 200 }) {
  const candidates = windowList().filter(
    win =>
      win.owner === owner &&
      win.w >= minWidth &&
      (titleIncludes ? win.title.includes(titleIncludes) : true),
  )
  // the largest is the document window rather than a palette or a tooltip.
  // The empty case is spelled out so callers' checks are not read as dead code:
  // indexing an array is typed as always finding something, and every caller
  // here has to handle a window that is not open yet.
  return candidates.length > 0
    ? candidates.sort((a, b) => b.w * b.h - a.w * a.h)[0]
    : undefined
}

// Placement is what the operator sees; the camera films by window id, so an
// occluded or off-space window still records correctly either way.
export function placeWindow(processName, { x, y, w, h }) {
  try {
    osa(
      `tell application "System Events" to tell process "${processName}" to tell window 1
         set position to {${x}, ${y}}
         set size to {${w}, ${h}}
       end tell`,
    )
    return true
  } catch {
    return false
  }
}
