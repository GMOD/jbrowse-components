/* eslint-disable  no-continue, no-plusplus */
import ComparativeServerSideRendererType from '@gmod/jbrowse-core/pluggableElementTypes/renderers/ComparativeServerSideRendererType'

export default class LinearSyntenyRenderer extends ComparativeServerSideRendererType {
  async render(renderProps: any) {
    const { height, width, views } = renderProps
    return {
      views,
      height,
      width,
    }
  }
}
