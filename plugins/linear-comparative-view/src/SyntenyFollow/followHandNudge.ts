import type { FollowWindow } from './followAnchorWindow.ts'

export interface LevelWindows {
  inputRow: string
  followedRow: string
}

export function followWindowSignature(windows: FollowWindow[]) {
  return windows.map(w => `${w.refName}:${w.start}-${w.end}`).join(',')
}

export function handNudged({
  now,
  previous,
  movedByFollow,
}: {
  now: LevelWindows
  previous: LevelWindows | undefined
  movedByFollow: boolean
}) {
  return (
    previous !== undefined &&
    !movedByFollow &&
    now.inputRow === previous.inputRow &&
    now.followedRow !== previous.followedRow
  )
}

export function handNudgeMessage(movingLabel: string, anchorLabel: string) {
  return `${movingLabel} is following ${anchorLabel}, so it moved back to the matching region`
}
