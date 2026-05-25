We have both packages/cigar-utils/src/mismatchParser.ts 11:const startClip = new
RegExp(/(\d+)[SH]$/) 145: ? +(startClip.exec(cigar) ?? [])[1]! || 0

plugins/alignments/src/MismatchParser/index.ts 9:const startClip = new
RegExp(/(\d+)[SH]$/) 171: ? +(startClip.exec(cigar) || [])[1]! || 0 i think we
should standardize on just the cigar-utils one
