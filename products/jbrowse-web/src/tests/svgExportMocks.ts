// jsdom's Blob does not support URL.createObjectURL; replace it with a plain
// object so SVG export tests can inspect the blob content directly via
// saveAs.mock.calls[0][0].content[0].
// @ts-expect-error
global.Blob = (content: unknown[], options: unknown) => ({ content, options })
