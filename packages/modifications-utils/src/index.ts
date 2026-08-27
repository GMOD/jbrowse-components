export { modificationRegex, parseModHeader } from './consts.ts'
export { matchesCytosineContext } from './cytosineContext.ts'
export type { CytosineContext } from './cytosineContext.ts'
export { detectSimplexModifications } from './detectSimplexModifications.ts'
export { forEachModRefPos } from './forEachModRefPos.ts'
export { getMethBins, isMethylationFillType } from './getMethBins.ts'
export type { ParsedModData } from './getMethBins.ts'
export { getModPositions } from './getModPositions.ts'
export type { ModWithPositions } from './getModPositions.ts'
export { getModTypes, isSingleModType } from './getModTypes.ts'
export type { ModTypeHeader } from './getModTypes.ts'
export {
  getModProbabilities,
  getModProbabilityBytes,
  modProbAt,
} from './getModProbabilities.ts'
export { getTag, getTagAlt } from './getTagAlt.ts'
export type { ModificationType } from './types.ts'
