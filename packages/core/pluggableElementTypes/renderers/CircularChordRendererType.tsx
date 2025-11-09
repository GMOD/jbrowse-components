import FeatureRenderer from './FeatureRendererType'
import RpcRenderedSvgGroup from './RpcRenderedSvgGroup'
import { SimpleFeature } from '../../util'

import type { SimpleFeatureSerialized } from '../../util'
import type { ThemeOptions } from '@mui/material'

export default class CircularChordRendererType extends FeatureRenderer {
  supportsSVG = true

  deserializeResultsInClient(
    res: { features: SimpleFeatureSerialized[]; html: string },
    args: {
      displayModel?: any
      theme: ThemeOptions
      exportSVG?: { rasterizeLayers?: boolean }
    },
  ) {
    const deserializedFeatures = new Map(
      res.features.map(f => SimpleFeature.fromJSON(f)).map(f => [f.id(), f]),
    )
    // if we are rendering svg, we skip hydration only return the res if the
    // renderer explicitly has this.supportsSVG support to avoid garbage
    // being rendered in SVG document
    return args.exportSVG
      ? {
          ...res,
          features: deserializedFeatures,
          blockKey: 'circularChord',
          html: this.supportsSVG
            ? res.html
            : '<text y="12" fill="black">SVG export not supported for this track</text>',
        }
      : {
          ...res,
          features: deserializedFeatures,
          blockKey: 'circularChord',
          reactElement: (
            <RpcRenderedSvgGroup
              {...args}
              {...res}
              features={deserializedFeatures}
              RenderingComponent={this.ReactComponent}
            />
          ),
        }
  }
}
