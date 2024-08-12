export type Entry = [string, string[]]

// example (see parseArgv.test.js):
// const args =
//   '--bam dad.bam color:red --vcf variants.vcf --bam mom.bam --defaultSession --out out.svg --noRasterize'
//
// expect(parseArgv(args.split(' '))).toEqual([
//   ['bam', ['dad.bam', 'color:red']],
//   ['vcf', ['variants.vcf']],
//   ['bam', ['mom.bam']],
//   ['defaultSession', []],
//   ['out', ['out.svg']],
//   ['noRasterize', []],
// ])
export function parseArgv(argv: string[]) {
  const map = [] as Entry[]
  while (argv.length) {
    const val = argv[0]!.slice(2)
    argv = argv.slice(1)
    const next = argv.findIndex(arg => arg.startsWith('-'))

    if (next !== -1) {
      map.push([val, argv.slice(0, next)])
      argv = argv.slice(next)
    } else {
      map.push([val, argv])
      break
    }
  }
  return map
}

export function standardizeArgv(args: Entry[], trackTypes: string[]) {
  const result = { trackList: [] } as {
    trackList: Entry[]
    out?: string
    pngwidth?: string
    [key: string]: unknown
  }
  args.forEach(arg => {
    if (trackTypes.includes(arg[0])) {
      result.trackList.push(arg)
    } else {
      result[arg[0]] = arg[1][0] || true
    }
  })
  return result
}
