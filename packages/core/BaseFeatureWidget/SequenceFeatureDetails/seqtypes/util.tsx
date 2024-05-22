import React from 'react'

export function splitString(str: string, size: number, initial: number) {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)

  let iter = 0
  let offset = 0
  for (; iter < numChunks + 1; ++iter) {
    const inc = iter === 0 ? size - initial : size
    const r = str.slice(offset, offset + inc)
    if (!r) {
      break
    }
    chunks[iter] = r
    offset += inc
  }

  return {
    segments: chunks,
    remainder: ((chunks.at(-1)?.length || 0) + (iter < 2 ? initial : 0)) % size,
  }
}
export function SplitString({
  chunks,
  size,
  start,
  color,
}: {
  chunks: string[]
  size: number
  start: number
  color?: string
}) {
  return chunks.map((s, idx) => {
    const f = Math.floor(start / 100) * 100
    const prefix =
      (idx == 0 && start % size == 0) || idx > 0
        ? `${f + idx * size}`.padStart(4) + '   '
        : ''
    const postfix =
      idx === chunks.length - 1 &&
      (chunks.at(-1)?.length || 0) + (idx === 0 ? start % 100 : 0) !== size
        ? null
        : '\n'
    return (
      <React.Fragment key={s + '-' + idx}>
        {prefix}
        <span style={{ background: color }}>{s}</span>
        {postfix}
      </React.Fragment>
    )
  })
}
