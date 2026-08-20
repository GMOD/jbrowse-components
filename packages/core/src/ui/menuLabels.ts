/**
 * Menu row LABELS, as opposed to the rows themselves — the builders that make a
 * row live in `toggleMenuItems.ts` and its neighbours, and take a label they do
 * not compose.
 *
 * Its own module because a label is not a row: `withHint` is reached from radio
 * options and from hand-written literals as often as from a builder, so filing
 * it under the checkbox builders put it behind an import that half its callers
 * had no other reason to make.
 *
 * Same purity boundary as the rest of `menuItems.ts` — no react, @mui or
 * @emotion, ever (`menuItems.purity.test.ts`).
 */

/**
 * #menuBuilder withHint | a row label carrying an aside that is only sometimes there
 *
 * `withHint('Show row separators', tooShort ? 'needs rows 4px or taller' :
 * undefined)`.
 *
 * The rows that want this are the ones that can be on, correctly on, and doing
 * nothing observable -- a band overridden by the summary tier, a separator
 * below the height it draws at. The tick keeps reporting what the user chose,
 * so silence would leave the setting looking broken.
 *
 * IN THE LABEL rather than a `subLabel`, which is what these were: a second
 * line under the row is heavy for a clarifier this short, and rather than a
 * `helpText`, which would reserve a "?" column across the whole menu for one
 * conditional row and hide the reason behind a hover -- on a control the reader
 * has no reason to hover, since from the tick it looks like it already works.
 *
 * AN EM DASH, NOT PARENTHESES. Two of these labels already end in a
 * parenthetical of their own ("Show conservation (% identity)", "Codon changes
 * (amino acids)"), and a second pair straight after the first reads as a typo.
 * It also keeps the aside distinct from the ` - ` that names a permanent half of
 * a label ("Square view - average bp per pixel").
 *
 * KEEP THE HINT SHORT -- a few words, not a sentence. A menu sizes to its widest
 * row, so a long one widens every row for as long as it fires, which is the same
 * cost that rules out `helpText` above.
 */
export function withHint(label: string, hint: string | undefined) {
  return hint ? `${label} — ${hint}` : label
}
