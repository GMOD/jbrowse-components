import { Feature } from '@jbrowse/core/util'
import { drawLine } from '../drawxy'
import { groupBy } from '../util'
import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

interface MultiRenderArgs extends RenderArgsDeserializedWithFeatures {
  sources: string[]
  sourceColors: { [key: string]: string }
}

export default class MultiLineRenderer extends WiggleBaseRenderer {
  // @ts-ignore
  async draw(ctx: CanvasRenderingContext2D, props: MultiRenderArgs) {
    const { sources, features } = props
    const groups = groupBy([...features.values()], f => f.get('source'))
    let feats = [] as Feature[]
    sources.forEach(source => {
      const features = groups[source]
      if (!features) {
        return
      }
      const { reducedFeatures } = drawLine(ctx, { ...props, features })
      feats = feats.concat(reducedFeatures)
    })
    return { reducedFeatures: feats }
  }
}
