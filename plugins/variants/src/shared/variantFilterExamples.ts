import type { JexlFilterExample } from '@jbrowse/core/ui/JexlFilterDialog'

/**
 * The jexl filter dialog's examples on a VCF track, written as transliterations
 * of the bcftools filtering expressions people arrive with (#939) — the
 * left-hand column of the docs at
 * https://samtools.github.io/bcftools/bcftools.html#expressions.
 *
 * Most of that vocabulary needs no function at all: a VCF feature exposes QUAL,
 * FILTER, REF, ALT and INFO by name, and jexl resolves a member access on a
 * single-element array against the element, so `feature.INFO.DP > 20` reads the
 * one-value INFO field bcftools spells `INFO/DP>20`. What the examples exist to
 * say is that this is so — the generic feature list teaches `get(feature,'x')`
 * and a `type=='gene'` test, neither of which is how a VCF is filtered.
 */
export const VARIANT_FILTER_EXAMPLES: JexlFilterExample[] = [
  {
    code: 'jexl:feature.QUAL > 30',
    description: 'site quality above 30 (bcftools QUAL>30)',
  },
  {
    code: "jexl:'PASS' in feature.FILTER",
    description: 'only sites that passed every filter (bcftools FILTER="PASS")',
  },
  {
    code: 'jexl:feature.INFO.DP > 20',
    description:
      'an INFO field by name (bcftools INFO/DP>20). A field holding several values needs an index, as in feature.INFO.AF[1]',
  },
  {
    code: 'jexl:maf(feature) > 0.05',
    description:
      'minor allele frequency over the called genotypes (bcftools MAF>0.05). Use feature.INFO.AF instead when the file states a frequency',
  },
  {
    code: 'jexl:missingness(feature) < 0.1',
    description:
      'fewer than 10% of alleles are no-calls (bcftools F_MISSING<0.1)',
  },
  {
    code: "jexl:genotypeCount(feature,'het') > 0",
    description:
      'at least one heterozygous sample (bcftools N_PASS(GT="het")>0). ref, alt, hom, het and mis are the classes',
  },
  {
    code: 'jexl:nAlt(feature) == 1',
    description: 'biallelic sites only (bcftools N_ALT=1)',
  },
  {
    code: 'jexl:alleleLength(feature) >= 50',
    description:
      'the SV tier of a callset — longest allele in bp, so a large insertion is not measured by the 1bp of reference it consumes (bcftools abs(ILEN)>=50)',
  },
  {
    code: "jexl:svType(feature) == 'DEL'",
    description:
      'deletions only, read off a symbolic ALT before falling back to INFO/SVTYPE (bcftools INFO/SVTYPE="DEL")',
  },
  {
    code: "jexl:impact(feature) == 'HIGH'",
    description: 'high-impact consequences, from a SnpEff ANN / VEP CSQ field',
  },
  {
    code: "jexl:'missense_variant' in consequences(feature)",
    description:
      'missense on any transcript, from that same annotation (bcftools INFO/CSQ ~ "missense_variant"). consequences(feature) lists every term on the record; consequence(feature) is the most severe one alone',
  },
]
