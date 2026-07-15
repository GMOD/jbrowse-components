// Classifies a VCF genotype string into a dosage code without allocating an
// intermediate split() array. Hot path: called per (source × feature) during
// clustering, where features may number in the tens of thousands and sources
// in the thousands.
//
//   0  = all alleles called and reference (e.g. "0/0", "0|0|0")
//   1  = mix of ref and non-ref called alleles (e.g. "0/1", "1|2")
//   2  = all alleles called and non-reference (e.g. "1/1", "1|2|3")
//  -1  = all alleles uncalled (e.g. "./.") or empty
//
// Multi-character allele indices like "10" are handled correctly — only the
// presence of a non-'0' digit matters for ref/non-ref classification.
export function classifyGenotypeDosage(
  val: string,
  start = 0,
  end = val.length,
) {
  let alleles = 0
  let nonRef = 0
  let uncalled = 0
  let started = false
  let alleleCalled = false
  let alleleIsRef = true
  for (let i = start; i < end; i++) {
    const c = val.charCodeAt(i)
    if (c === 47 /* / */ || c === 124 /* | */) {
      alleles++
      if (!alleleCalled) {
        uncalled++
      } else if (!alleleIsRef) {
        nonRef++
      }
      started = false
      alleleCalled = false
      alleleIsRef = true
    } else {
      started = true
      if (c !== 46 /* . */) {
        alleleCalled = true
        if (c !== 48 /* 0 */) {
          alleleIsRef = false
        }
      }
    }
  }
  if (started) {
    alleles++
    if (!alleleCalled) {
      uncalled++
    } else if (!alleleIsRef) {
      nonRef++
    }
  }
  if (alleles === 0 || uncalled === alleles) {
    return -1
  }
  if (nonRef === 0) {
    return 0
  }
  if (nonRef === alleles) {
    return 2
  }
  return 1
}
