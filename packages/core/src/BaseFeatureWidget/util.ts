export function getStrandStr(strand: number | undefined) {
  return strand === -1 ? '(-)' : strand === 1 ? '(+)' : ''
}
