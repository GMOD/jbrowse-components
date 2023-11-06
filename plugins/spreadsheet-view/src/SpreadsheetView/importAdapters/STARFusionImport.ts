export function parseSTARFusionBuffer(buffer: Buffer) {
  const str = new TextDecoder('utf8').decode(buffer)
  const lines = str.split(/\n|\r\n/)
  const header = lines[0].slice(1).split('\t')
  return {
    rows: lines
      .slice(1)
      .map(row =>
        Object.fromEntries(row.split('\t').map((c, i) => [header[i], c])),
      ),
    columns: header,
  }
}
