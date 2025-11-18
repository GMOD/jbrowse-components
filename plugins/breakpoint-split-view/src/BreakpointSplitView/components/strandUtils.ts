export function strandSymbolToDirection(strand: string) {
  if (strand === '+') {
    return 1
  }
  if (strand === '-') {
    return -1
  }
  return 0
}
