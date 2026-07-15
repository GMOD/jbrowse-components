import { parseStrand } from './util.ts'

// Rastair (https://www.rastair.com) emits a headered BED/TSV of per-CpG
// methylation calls from TAPS / mod-C→T data. Its layout differs from modkit
// bedMethyl, so it's identified by the header column names rather than
// positionally: #chr start end name beta_est strand unmod mod no_snp snp
// coverage genotype gt_p_score gt_conf_score
const RASTAIR_COLUMNS = ['beta_est', 'unmod', 'mod', 'coverage']

export function isRastairMethylFeature(names: string[]) {
  return RASTAIR_COLUMNS.every(col => names.includes(col))
}

export function generateRastairMethylFeature({
  splitLine,
  names,
  uniqueId,
  refName,
  start,
  end,
}: {
  splitLine: string[]
  names: string[]
  uniqueId: string
  refName: string
  start: number
  end: number
}) {
  const col = (name: string) => splitLine[names.indexOf(name)]
  // beta_est is a 0-1 fraction; the shared bedMethyl display path expects a
  // 0-100 percentage (modkit fraction_modified), so scale to match
  const fraction_modified = Number(col('beta_est')) * 100

  return {
    uniqueId,
    refName,
    start,
    end,
    // rastair reports modified C (5mC); use modkit's 'm' code so it groups and
    // colors as 5mC methylation in the shared bedMethyl display path
    code: 'm',
    source: 'm',
    score: fraction_modified,
    fraction_modified,
    strand: parseStrand(col('strand')),
    n_valid_cov: col('coverage'),
    n_mod: col('mod'),
    n_canonical: col('unmod'),
    beta_est: col('beta_est'),
    no_snp: col('no_snp'),
    snp: col('snp'),
    coverage: col('coverage'),
    genotype: col('genotype'),
    gt_conf_score: col('gt_conf_score'),
  }
}
