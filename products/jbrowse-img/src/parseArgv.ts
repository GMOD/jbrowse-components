import { parseArgs } from 'node:util'

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
  // First pass: identify all possible option names from the argv
  const optionNames = new Set<string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg && arg.startsWith('--')) {
      optionNames.add(arg.slice(2))
    }
  }

  // Build options config for parseArgs
  const options: Record<
    string,
    { type: 'string' | 'boolean'; multiple?: boolean }
  > = {}
  const trackTypes = [
    'bam',
    'cram',
    'vcfgz',
    'hic',
    'bigwig',
    'bigbed',
    'bedgz',
    'gffgz',
    'configtracks',
  ]

  for (const name of optionNames) {
    if (['defaultSession', 'noRasterize'].includes(name)) {
      options[name] = { type: 'boolean' }
    } else if (trackTypes.includes(name)) {
      options[name] = { type: 'string', multiple: true }
    } else {
      options[name] = { type: 'string' }
    }
  }

  const parsed = parseArgs({ args: argv, options, allowPositionals: true })

  // Convert to the expected format
  const result: Entry[] = []

  // Process options in the order they appear in argv
  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg && arg.startsWith('--')) {
      const optionName = arg.slice(2)
      i++

      if (options[optionName]?.type === 'boolean') {
        result.push([optionName, []])
      } else {
        const values: string[] = []
        // Collect values until next option or end
        while (i < argv.length) {
          const currentArg = argv[i]
          if (!currentArg || currentArg.startsWith('--')) {
            break
          }
          values.push(currentArg)
          i++
        }
        result.push([optionName, values])
      }
    } else {
      i++
    }
  }

  return result
}

export function standardizeArgv(args: Entry[], trackTypes: string[]) {
  const result = { trackList: [] } as {
    trackList: Entry[]
    out?: string
    pngwidth?: string
    [key: string]: unknown
  }
  for (const arg of args) {
    if (trackTypes.includes(arg[0])) {
      result.trackList.push(arg)
    } else {
      result[arg[0]] = arg[1][0] || true
    }
  }
  return result
}
