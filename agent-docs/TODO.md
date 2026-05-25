1. Use modProbAt from modifications-utils — renderModifications.ts and
   getMaximumModificationAtEachPosition.ts both inline the same
   probability-index calculation (probabilities?.[probIndex + (fstrand === -1 ?
   positions.length - 1 - idx : idx)] || 0) that modProbAt encapsulates. They
   could import and use it instead.

2. Extract the MM tag read — (getTagAlt(feature, 'MM', 'Mm') as string) || ''
   appears in 4 places. Per CLAUDE.md, || here is a code smell — getTagAlt can
   return a non-string (e.g. a number), so the cast is unsound. A small helper
   like getMMTag(feature): string would remove the repeated cast and ||.

3. getTagAlt in getMaximumModificationAtEachPosition.ts — this function reads mm
   and passes it to getModPositions, then computes probabilities manually using
   the inline index formula. Since getMethBins in modifications-utils now does
   all of this together (positions + probabilities + CpG filtering), there may
   be a path toward consolidating getMaxProbModAtEachPosition and getMethBins
   calls, though that's a bigger refactor only worth doing if the call sites
   overlap significantly.

Of these, (1) is the most mechanical and lowest-risk cleanup to do next. Want me
to go ahead with any of them?
