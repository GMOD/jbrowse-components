export function shorten(name: string, max = 70, short = 30) {
  return name.length > max
    ? `${name.slice(0, short)}...${name.slice(-short)}`
    : name
}

export function shorten2(name: string, max = 70) {
  return name.length > max ? `${name.slice(0, max)}...` : name
}

export function truncateMiddle(str: string, maxLen = 40) {
  if (str.length <= maxLen) {
    return str
  }
  const half = Math.floor((maxLen - 3) / 2)
  return `${str.slice(0, half)}...${str.slice(-half)}`
}
