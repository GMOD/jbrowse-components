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
