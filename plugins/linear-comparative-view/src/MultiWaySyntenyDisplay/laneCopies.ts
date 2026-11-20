const COPY = '@'

export function copyLane(assemblyName: string, refName: string) {
  return `${assemblyName}${COPY}${refName}`
}

export function laneGenome(lane: string) {
  const at = lane.indexOf(COPY)
  return at === -1 ? lane : lane.slice(0, at)
}

export function laneCopy(lane: string) {
  const at = lane.indexOf(COPY)
  return at === -1 ? undefined : lane.slice(at + 1)
}
