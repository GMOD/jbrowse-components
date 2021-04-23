import { Feature } from '@jbrowse/core/util/simpleFeature'
// get tag from BAM or CRAM feature, where CRAM uses feature.get('tags') and
// BAM does not
export function getTag(feature: Feature, tag: string) {
  const tags = feature.get('tags')
  return tags ? tags[tag] : feature.get(tag)
}

// use fallback alt tag, used in situations where upper case/lower case tags
// exist e.g. Mm/MM for base modifications
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  return getTag(feature, tag) || getTag(feature, alt)
}
