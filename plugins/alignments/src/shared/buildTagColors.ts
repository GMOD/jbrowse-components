import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'

import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

type ColorRgbTuple = [number, number, number]

export function buildTagColors(
  featuresData: FeatureData[],
  tagColorValues: string[],
  colorBy: { type: string; tag?: string },
  colorTagMap: Record<string, string>,
) {
  const tag = colorBy.tag!
  const parsedColors = new Map<string, ColorRgbTuple>()
  for (const [k, v] of Object.entries(colorTagMap)) {
    parsedColors.set(k, cssColorToRgb(v))
  }
  const fwdStrandRgb: ColorRgbTuple = [236, 139, 139]
  const revStrandRgb: ColorRgbTuple = [143, 143, 216]
  const nostrandRgb: ColorRgbTuple = [200, 200, 200]

  // Pack one ABGR u32 per read. Shader reads `uint tagColor` and unpacks;
  // 0 means "no tag color set" (falls back to the palette).
  const readTagColors = new Uint32Array(featuresData.length)
  for (let i = 0; i < featuresData.length; i++) {
    const featuresDatum = featuresData[i]!
    const val = tagColorValues[i] ?? ''
    let rgb: ColorRgbTuple

    if (tag === 'XS' || tag === 'TS') {
      rgb =
        val === '-' ? revStrandRgb : val === '+' ? fwdStrandRgb : nostrandRgb
    } else if (tag === 'ts') {
      const featureStrand = featuresDatum.strand
      if (val === '-') {
        rgb = featureStrand === -1 ? fwdStrandRgb : revStrandRgb
      } else if (val === '+') {
        rgb = featureStrand === -1 ? revStrandRgb : fwdStrandRgb
      } else {
        rgb = nostrandRgb
      }
    } else {
      rgb = parsedColors.get(val) ?? nostrandRgb
    }
    readTagColors[i] = packAbgr(rgb[0], rgb[1], rgb[2], 255)
  }
  return readTagColors
}

export function extractFeatureTagValue(feature: Feature, tag: string) {
  const tags = feature.get('tags')
  const val = tags ? tags[tag] : feature.get(tag)
  return val != null ? String(val) : ''
}
