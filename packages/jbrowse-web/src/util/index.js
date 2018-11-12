export function assembleLocString({ assembly, refName, start, end }) {
  return `${assembly}:${refName}:${start}-${end}`
}

export function fog() {}
