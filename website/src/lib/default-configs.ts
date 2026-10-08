// The hosted config a `loc=` fence opens when it names no `config=`, by the
// fence's first assembly name. Each value is a config whose first assembly is
// that key. `gen-hosted-configs` digests every one, and `check-session-urls`
// reads the digest.
export const defaultConfigs: Record<string, string> = {
  hg38: 'https://jbrowse.org/ucsc/hg38/config.json',
  hg19: 'https://jbrowse.org/ucsc/hg19/config.json',
  mm39: 'https://jbrowse.org/ucsc/mm39/config.json',
  mm10: 'https://jbrowse.org/ucsc/mm10/config.json',
  dm6: 'https://jbrowse.org/ucsc/dm6/config.json',
  ce11: 'https://jbrowse.org/ucsc/ce11/config.json',
  bosTau9: 'https://jbrowse.org/ucsc/bosTau9/config.json',
}

export function defaultConfigUrl(assembly: string) {
  return Object.hasOwn(defaultConfigs, assembly)
    ? defaultConfigs[assembly]
    : undefined
}
