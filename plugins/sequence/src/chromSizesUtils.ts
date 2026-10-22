export function parseChromSizes(data: string) {
  const result: Record<string, number> = {}
  for (const line of data.split(/\r?\n|\r/)) {
    const [name, length] = line.split('\t')
    if (name && length) {
      result[name] = +length
    }
  }
  return result
}

export function refSizesToRegions(refSizes: Record<string, number>) {
  return Object.entries(refSizes).map(([refName, end]) => ({
    refName,
    start: 0,
    end,
  }))
}
