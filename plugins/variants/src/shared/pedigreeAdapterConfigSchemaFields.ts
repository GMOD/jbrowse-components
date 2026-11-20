export const pedigreeAdapterConfigSchemaFields = {
  /**
   * #slot
   */
  pedigreeLocation: {
    type: 'maybeFileLocation',
    description:
      "optional pedigree of the VCF's samples, whitespace-separated: a PLINK `.fam` or `.ped` with no header (FID, IID, PAT, MAT, SEX, PHENO; a `.ped`'s genotypes after them are not read), or a table whose header row names its columns `SampleID` or `IID`, `FatherID` or `PAT`, `MotherID` or `MAT`, `FamilyID` or `FID`, `Sex` and `Phenotype` or `PHENO`, in any case and order, as 1000 Genomes' `20130606_g1k_3202_samples_ped_population.txt` does. Each sample gains the attributes `family`, `father`, `mother`, `sex` (`male`, `female` or `other`) and `phenotype` (`affected` or `unaffected`), which the variant display groups, sorts, colors and tooltips rows by. A parent of `0`, a sex of `0`, `-9` or `unknown` and a phenotype of `0` or `-9` are no value, and the Mendelian check reads a samples table's `sex` column by the same codes. An IID naming no VCF sample is tried as `FID_IID`, the sample name PLINK's `--recode vcf` writes. A `samplesTsvLocation` column of the same name wins over the pedigree's. The pedigree never narrows the samples: its rows naming no VCF sample are skipped, and a pedigree matching none of them adds nothing, with a warning",
  },
} as const
