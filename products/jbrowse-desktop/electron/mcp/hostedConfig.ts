// A bare "hg38" is the likeliest first thing an agent passes to `open`, and the
// relative-path answer told it nothing. The two hosted URL shapes are
// constructible without a lookup (website/docs/agents_hosted_data.md), so the
// error names the URL — it does not fetch it, because a guessed config off a
// typo is a request nobody asked for.
export function hostedConfigUrl(target: string) {
  const genark = /^GC[AF]_\d{9}\.\d+$/.exec(target)?.[0]
  if (genark) {
    const [prefix, digits] = genark.split('_') as [string, string]
    const fan = [0, 3, 6].map(i => digits.slice(i, i + 3)).join('/')
    return `https://jbrowse.org/hubs/genark/${prefix}/${fan}/${genark}/config.json`
  }
  return /^[a-z][A-Za-z]{1,9}\d{1,3}$/.test(target)
    ? `https://jbrowse.org/ucsc/${target}/config.json`
    : undefined
}
