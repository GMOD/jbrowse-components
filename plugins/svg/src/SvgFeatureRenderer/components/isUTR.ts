import { Feature } from '@jbrowse/core/util'

/**
 * Determines if a feature is an untranslated region (UTR)
 *
 * This function checks if the feature type contains UTR-related keywords
 * such as "UTR", "_UTR", or "untranslated region".
 *
 * @param feature - The genomic feature to check
 * @returns True if the feature is a UTR, false otherwise
 */
export function isUTR(feature: Feature) {
  return /(\bUTR|_UTR|untranslated[_\s]region)\b/i.test(
    feature.get('type') || '',
  )
}
