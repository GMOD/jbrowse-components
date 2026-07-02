// jb2hubs assemblies are frequently already named with UCSC db ids (hg38, mm39,
// …) so identity is the default. This covers the common GRC/T2T aliases that
// aren't literal UCSC db names.
const aliases: Record<string, string> = {
  GRCh38: 'hg38',
  GRCh37: 'hg19',
  hg38: 'hg38',
  hg19: 'hg19',
  GRCm39: 'mm39',
  GRCm38: 'mm10',
  'T2T-CHM13v2.0': 'hs1',
  'T2T-CHM13': 'hs1',
  chm13: 'hs1',
}

export function assemblyToUcscDb(name: string) {
  return aliases[name] ?? name
}
