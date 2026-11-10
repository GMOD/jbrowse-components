// A tail on more records than this is a naming convention rather than a name:
// `as1` ends 2,437 antisense gene symbols in RefSeq hg38, and indexing it would
// answer a search for `as1` with an arbitrary hundred of them. The search box
// lists 100 hits.
const MAX_TAIL_RECORDS = 100

const MIN_TAIL_START = 3

const boundary = /[^\p{L}\p{N}]+/gu
const startsWithName = new RegExp(
  `^(?!\\p{N}+(?:[^\\p{L}\\p{N}]|$))[\\p{L}\\p{N}]{${MIN_TAIL_START},}`,
  'u',
)

/**
 * The rest of `word` from each punctuation mark on, where what follows the mark
 * reads as a name: `HLA-DRB1-AS1` gives `drb1-as1` and `as1`, and
 * `NM_000059.4` gives nothing, its pieces being too short or all digits. A
 * search matches a word by its prefix, so these are what let `drb1` find
 * `HLA-DRB1`.
 */
export function wordTails(word: string) {
  return [...word.matchAll(boundary)]
    .map(({ index, 0: mark }) => word.slice(index + mark.length).toLowerCase())
    .filter(tail => startsWithName.test(tail))
}

/**
 * `lines` as given, followed by a line for each tail few enough records share.
 * A tail is only known to be rare once every record is read, so tails wait in
 * memory until the end, at most MAX_TAIL_RECORDS records apiece.
 */
export async function* withWordTails(lines: AsyncIterable<string>) {
  const rare = new Map<string, string[]>()
  const common = new Set<string>()
  for await (const line of lines) {
    yield line
    const [record, ...words] = line.trimEnd().split(' ')
    const own = new Set(words.map(word => word.toLowerCase()))
    for (const tail of new Set(words.flatMap(wordTails))) {
      if (record && !own.has(tail) && !common.has(tail)) {
        const records = rare.get(tail) ?? []
        if (records.length < MAX_TAIL_RECORDS) {
          records.push(record)
          rare.set(tail, records)
        } else {
          rare.delete(tail)
          common.add(tail)
        }
      }
    }
  }
  for (const [tail, records] of rare) {
    for (const record of records) {
      yield `${record} ${tail}\n`
    }
  }
}
