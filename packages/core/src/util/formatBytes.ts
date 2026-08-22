const units = ['bytes', 'kB', 'MB', 'GB', 'TB']

/**
 * A byte count for a human, in SI units — 1 kB is 1000 bytes, which is what the
 * unit means and what a file manager reports. The two hand-rolled copies this
 * replaced disagreed: one was SI, the other divided by 1024 and labelled the
 * result "KB", so it read ~2.4% low by the third step and called a KiB a kB.
 *
 * Whole bytes stay whole; every step above gets one decimal.
 */
export function formatBytes(bytes: number) {
  let n = bytes
  let i = 0
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000
    i++
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`
}
