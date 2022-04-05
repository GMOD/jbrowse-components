import OffscreenCanvasRenderingContext2DShim from './Canvas2DContextShim'

export default class OffscreenCanvasShim {
  width: number
  height: number
  context: OffscreenCanvasRenderingContext2DShim

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.context = new OffscreenCanvasRenderingContext2DShim(
      this.width,
      this.height,
    )
  }

  getContext(type: '2d') {
    if (type !== '2d') {
      throw new Error(`unknown type ${type}`)
    }
    return this.context
  }

  toDataURL(): string {
    throw new Error('not supported')
  }

  getSerializedSvg() {
    return this.context?.getSerializedSvg()
  }
}
