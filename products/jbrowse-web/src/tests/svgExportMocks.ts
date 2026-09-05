import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

// jsdom's Blob does not support URL.createObjectURL; replace it with a plain
// object so SVG export tests can inspect the blob content directly via
// saveAs.mock.calls[0][0].content[0]. Must be newable (saveSvgAsImage does
// `new Blob(...)`), so a class rather than an arrow function.
// @ts-expect-error
global.Blob = class {
  content: unknown[]
  options: unknown
  constructor(content: unknown[], options: unknown) {
    this.content = content
    this.options = options
  }
}

// node-canvas measures text with whatever fontconfig answers on the machine, so
// a figure whose layout turns on a label width — synteny's off-screen mate
// labels merge, fit and centre on it — would snapshot the machine's fonts. Pin
// every 2D context to the advance table SvgCanvas measures with, so the figure
// is the same one on every machine and its text lands where the export's own
// `<text>` measured it.
const table = new SvgCanvas()
const ctx2d = document.createElement('canvas').getContext('2d')!
Object.getPrototypeOf(ctx2d).measureText = function (
  this: CanvasRenderingContext2D,
  text: string,
) {
  table.font = this.font
  return table.measureText(text) as TextMetrics
}
