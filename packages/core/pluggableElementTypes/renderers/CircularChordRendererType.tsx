import React from 'react'
import SimpleFeature, {
  SimpleFeatureSerialized,
} from '../../util/simpleFeature'
import FeatureRenderer from './FeatureRendererType'
import RpcRenderedSvgGroup from './RpcRenderedSvgGroup'

export default class CircularChordRendererType extends FeatureRenderer {
  deserializeResultsInClient(
    res: { features: SimpleFeatureSerialized[]; html: string },
    args: { exportSVG?: { rasterizeLayers?: boolean } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    const deserializedFeatures = new Map<string, SimpleFeature>(
      res.features.map(f => SimpleFeature.fromJSON(f)).map(f => [f.id(), f]),
    )
    // if we are rendering svg, we skip hydration
    if (args.exportSVG) {
      // only return the res if the renderer explicitly has
      // this.supportsSVG support to avoid garbage being rendered in SVG
      // document
      return {
        ...res,
        html: this.supportsSVG
          ? res.html
          : '<text y="12" fill="black">SVG export not supported for this track</text>',
      }
    }

    // hydrate res using ServerSideRenderedContent
    return {
      ...res,
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
