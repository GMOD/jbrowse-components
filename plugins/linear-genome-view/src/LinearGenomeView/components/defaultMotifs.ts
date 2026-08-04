// A starting point, not a database: this is only the initial value of the motif
// textarea, so a user can wipe it and paste their own enzyme set (or any motif
// set at all) from REBASE or elsewhere. Sites use REBASE notation: '^' for a cut
// inside the site, '(n/m)' for the type IIS enzymes that cut downstream of it —
// the prefill sticks to the classic '^' cutters, but both parse.
export const DEFAULT_MOTIFS = `# name<space>site — '^' or, cutting downstream, '(n/m)'. Edit freely.
EcoRI   G^AATTC
BamHI   G^GATCC
HindIII A^AGCTT
NotI    GC^GGCCGC
XhoI    C^TCGAG
SalI    G^TCGAC
PstI    CTGCA^G
SmaI    CCC^GGG
KpnI    GGTAC^C
SacI    GAGCT^C
XbaI    T^CTAGA
SpeI    A^CTAGT
NcoI    C^CATGG
NdeI    CA^TATG
EcoRV   GAT^ATC
BglII   A^GATCT`
