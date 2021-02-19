import { toArray } from 'rxjs/operators'
import BedTabixAdapter from './BedTabixAdapter'
import MyConfigSchema from './configSchema'

test('adapter can fetch features from volvox-bed12.bed.gz', async () => {
  const adapter = new BedTabixAdapter(
    MyConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve('./test_data/volvox-bed12.bed.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/volvox-bed12.bed.gz.tbi'),
        },
      },
    }),
  )

  const features = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(0, 10)).toMatchSnapshot()
})

test('adapter can fetch features from volvox.sort.bed.gz simple bed3', async () => {
  const adapter = new BedTabixAdapter(
    MyConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve('./test_data/volvox.sort.bed.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/volvox.sort.bed.gz.tbi'),
        },
      },
    }),
  )

  const features = adapter.getFeatures({
    refName: 'contigA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('contigA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(0, 10)).toMatchSnapshot()
})

test('adapter can fetch features bed with autosql', async () => {
  const adapter = new BedTabixAdapter(
    MyConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve('./test_data/volvox-autosql.bed.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/volvox-autosql.bed.gz.tbi'),
        },
      },
      autoSql: `table gdcCancer
"somatic variants converted from MAF files obtained through the NCI GDC"
    (
    string chrom;      "Chromosome (or contig, scaffold, etc.)"
    uint   chromStart; "Start position in chromosome"
    uint   chromEnd;   "End position in chromosome"
    string name;       "Name of item"
    uint   score;      "Score from 0-1000"
    char[1] strand;    "+ or -"
    uint thickStart;   "Start of where display should be thick (start codon)"
    uint thickEnd;     "End of where display should be thick (stop codon)"
    uint reserved;     "Used as itemRgb as of 2004-11-22"
    int blockCount;    "Number of blocks"
    int[blockCount] blockSizes; "Comma separated list of block sizes"
    int[blockCount] chromStarts; "Start positions relative to chromStart"
    string sampleCount;    "Number of samples with this variant"
    string freq;                    "Variant frequency"
    lstring Hugo_Symbol;            "Hugo symbol"
    lstring Entrez_Gene_Id;         "Entrez Gene Id"
    lstring Variant_Classification; "Class of variant"
    lstring Variant_Type;           "Type of variant"
    lstring Reference_Allele;       "Reference allele"
    lstring Tumor_Seq_Allele1;      "Tumor allele 1"
    lstring Tumor_Seq_Allele2;      "Tumor allele 2"
    lstring dbSNP_RS;               "dbSNP RS number"
    lstring dbSNP_Val_Status;       "dbSNP validation status"
    lstring days_to_death;          "Number of days till death"
    lstring cigarettes_per_day;     "Number of cigarettes per day"
    lstring weight;                 "Weight"
    lstring alcohol_history;        "Any alcohol consumption?"
    lstring alcohol_intensity;      "Frequency of alcohol consumption"
    lstring bmi;                    "Body mass index"
    lstring years_smoked;           "Number of years smoked"
    lstring height;                 "Height"
    lstring gender;                 "Gender"
    lstring project_id;             "TCGA Project id"
    lstring ethnicity;              "Ethnicity"
    lstring Tumor_Sample_Barcode;   "Tumor sample barcode"
    lstring Matched_Norm_Sample_Barcode;  "Matcheds normal sample barcode"
    lstring case_id;                "Case ID number"
)`,
    }),
  )
  const features = adapter.getFeatures({
    refName: 'ctgA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('ctgA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(0, 10)).toMatchSnapshot()
})

test('adapter can fetch bed with header', async () => {
  const adapter = new BedTabixAdapter(
    MyConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve(
          './test_data/volvox.sort.with.header.bed.gz',
        ),
      },
      index: {
        location: {
          localPath: require.resolve(
            './test_data/volvox.sort.with.header.bed.gz.tbi',
          ),
        },
      },
    }),
  )

  const features = adapter.getFeatures({
    refName: 'contigA',
    start: 0,
    end: 20000,
    assemblyName: 'volvox',
  })
  expect(await adapter.hasDataForRefName('contigA')).toBe(true)
  expect(await adapter.hasDataForRefName('ctgB')).toBe(false)

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(0, 10)).toMatchSnapshot()
})

test('adapter can use gwas header', async () => {
  const adapter = new BedTabixAdapter(
    MyConfigSchema.create({
      bedGzLocation: {
        localPath: require.resolve('./test_data/gwas.bed.gz'),
      },
      index: {
        location: {
          localPath: require.resolve('./test_data/gwas.bed.gz.tbi'),
        },
      },
    }),
  )

  const features = adapter.getFeatures({
    refName: '1',
    start: 0,
    end: 100_000,
    assemblyName: 'hg19',
  })

  const featuresArray = await features.pipe(toArray()).toPromise()
  const featuresJsonArray = featuresArray.map(f => f.toJSON())
  expect(featuresJsonArray.slice(0, 10)).toMatchSnapshot()
})
