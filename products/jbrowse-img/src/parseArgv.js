export function parseArgv(argv) {
  const map = []
  while (argv.length) {
    const val = argv[0].slice(2)
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

export function standardizeArgv(args, trackTypes) {
  const result = { trackList: [] }
  args.forEach(arg => {
    if (trackTypes.includes(arg[0])) {
      result.trackList.push(arg)
    } else {
      result[arg[0]] = arg[1][0] || true
    }
  })
  return result
}
