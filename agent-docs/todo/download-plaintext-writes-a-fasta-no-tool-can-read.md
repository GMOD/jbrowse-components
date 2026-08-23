---
name: download-plaintext-writes-a-fasta-no-tool-can-read
description: a product call, and it moves "Copy plaintext" too
metadata:
  area: feature details
  category: ready
---

# "Download plaintext" writes a FASTA no tool can read

`getSequencePlaintext` takes the rendered panel's `textContent` after dropping
`[data-no-plaintext]` nodes, which strips the legend. It does not strip the
coordinate labels, because those are ordinary text in the sequence rows. With
"Show coordinates" on — a sticky preference, so it persists across sessions —
`sequence.txt` comes out as a `>`-prefixed FASTA header followed by rows each
carrying their own position number. Nothing downstream parses that, and the file
extension and the header both promise it does.

The mechanism is already there: mark the label spans `data-no-plaintext` and the
existing strip handles them. What is not decided is whether it should. Someone
pasting into a text editor to read positions alongside bases may want exactly
what it writes today, and "Copy plaintext" shares the same helper, so a change
moves both. The split worth considering is that download implies a file for a
tool while copy implies a human, which argues for stripping in the download path
only — but that makes two behaviors out of one helper, so it needs a deliberate
yes rather than a drive-by.
