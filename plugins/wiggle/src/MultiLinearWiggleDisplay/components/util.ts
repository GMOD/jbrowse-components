export function moveUp(arr: { name: string }[], sel: string[], by = 1) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => a - b)
  let lastIdx = 0
  for (let i = 0; i < idxs.length; i++) {
    const old = idxs[i]
    const idx = Math.max(lastIdx, old - by)
    if (idx >= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0])
    }
    lastIdx = lastIdx + 1
  }

  return arr
}

export function moveDown(arr: { name: string }[], sel: string[], by = 1) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => b - a)
  let lastIdx = arr.length - 1
  for (let i = 0; i < idxs.length; i++) {
    const old = idxs[i]
    const idx = Math.min(lastIdx, old + by)
    if (idx <= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0])
    }
    lastIdx = lastIdx - 1
  }

  return arr
}
