// A starting point, not a database: this is only the initial value of the motif
// textarea, so a user can wipe it and paste their own enzyme set (or any motif
// set at all) from REBASE or elsewhere. Sites use REBASE notation, '^' marking
// the top-strand cut.
export const DEFAULT_MOTIFS = `# name<space>site — '^' marks the cut. Edit or replace freely.
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
