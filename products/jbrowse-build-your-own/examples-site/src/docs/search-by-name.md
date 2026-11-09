The index is three files from `jbrowse text-index`. Each hit records the
`trackId` it was built against, here `genes`; with another id the view navigates
but shows no track. `BRC` matches five genes and none exactly, so
`navToLocString` resolves `false` and raises `view.searchPicker`, which the
`LocationBox` lists. `NavButton` reports `zzzznotagene`, which matches nothing,
as a warning.
