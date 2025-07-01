// Regexes based on parse_mm.pl from hts-specs
// https://github.com/samtools/hts-specs/blob/f907ead164780fdbcce6a0807c551413dbf18ca1/test/SAMtags/parse_mm.pl#L73
// Modified to not have the ,(.*) because we saw examples with 'C+m,192,445,157,36,12,39,21,30,5,0,2,1,9,29,6,186,109,8,0,66,57,431,168,16,20,0,58,152,333,8,32,54,12,4,147,2,5,0,1,6,4,1,35,3,282,7,24,4,35,3,42,8,4,81,60,50,37,7,529,138,14,106,327,667;C+h;' and C+h does not have a comma
export const modificationRegex = new RegExp(
  /([A-Z])([-+])([a-z]+|[0-9]+)([.?]?)/,
)
