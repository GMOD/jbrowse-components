import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'
import { Base1DViewModel } from '@gmod/jbrowse-core/util/Base1DViewModel'

export default class LinearSyntenyRenderer extends ComparativeServerSideRendererType {
  async render(renderProps: {
    height: number
    width: number
    views: Base1DViewModel[]
  }) {
    const { height, width, views } = renderProps
    return {
      views,
      height,
      width,
    }
  }
}
