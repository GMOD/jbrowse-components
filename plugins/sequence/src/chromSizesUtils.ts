export function parseChromSizes(data: string) {
  const result: Record<string, number> = {}
  for (const line of data.split(/\n|\r\n|\r/)) {
    const [name, length] = line.split('\t')
    if (name && length) {
      result[name] = +length
    }
  }
  return result
}

export function refSizesToRegions(refSizes: Record<string, number>) {
  return Object.keys(refSizes).map(refName => ({
    refName,
    start: 0,
    end: refSizes[refName]!,
  }))
}
