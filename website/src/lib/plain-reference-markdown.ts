// The generated config and model pages carry HTML the rendered site needs and a
// reader of the raw Markdown does not: a `<dialog>` holding each long type or
// example, an anchor `<span>` on each member name, pagefind hints. Off the page
// those are most of the bytes, so the copy `/llms.txt` links states each cell's
// full content inline instead.

const DIALOG_CELL =
  /<span class="cell-more"><button type="button" class="cell-more-trigger">([\s\S]*?)<\/button><dialog class="cell-dialog"><form method="dialog">[\s\S]*?<\/form>([\s\S]*?)<\/dialog><\/span>/g

function inlineDialogBody(body: string) {
  return body
    .replaceAll(/<\/?p>/g, ' ')
    .replaceAll('<pre><code>', '<code>')
    .replaceAll('</code></pre>', '</code>')
    .replaceAll('&#10;', ' ')
    .replaceAll('&#160;', '')
    .replaceAll(/ {2,}/g, ' ')
    .trim()
}

export function plainReferenceMarkdown(markdown: string) {
  return markdown
    .replaceAll(DIALOG_CELL, (_, trigger: string, body: string) =>
      trigger.startsWith('<code>')
        ? inlineDialogBody(body)
        : `${trigger}: ${inlineDialogBody(body)}`,
    )
    .replaceAll(/<span id="[^"]*">([\s\S]*?)<\/span>/g, '$1')
    .replaceAll('<span data-pagefind-ignore>', '')
    .replaceAll('</span>', '')
    .replaceAll('<!-- prettier-ignore -->\n', '')
}
