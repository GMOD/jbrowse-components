// Structural param so any observable string array fits.
export function toggleArrayMember(
  arr: {
    indexOf: (v: string) => number
    push: (v: string) => unknown
    splice: (start: number, deleteCount: number) => unknown
  },
  id: string,
) {
  const idx = arr.indexOf(id)
  if (idx === -1) {
    arr.push(id)
  } else {
    arr.splice(idx, 1)
  }
}
