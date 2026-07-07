import gzip
from collections import defaultdict

# ---- load real data as AlignmentData-equivalent ----
alns=[];qlen={};tlen={}
for line in gzip.open("hap1.pif.gz","rt"):
    f=line.rstrip("\n").split("\t")
    if not f[0].startswith("q"): continue
    q=f[0][1:]; qlen[q]=int(f[1]); tlen[f[5]]=int(f[6])
    # AlignmentData: refRefName=q(hap1,x), queryRefName=t(GRCh38,y) as in dotplot
    # (referenceRegions=hview=hap1, currentRegions=vview=GRCh38)
    alns.append(dict(refRefName=q, refStart=int(f[2]), refEnd=int(f[3]),
                     queryRefName=f[5], queryStart=int(f[7]), queryEnd=int(f[8]),
                     strand=1 if f[4]=="+" else -1))
MIN=5_000_000
alns=[a for a in alns if qlen[a["refRefName"]]>=MIN and tlen[a["queryRefName"]]>=MIN]

# region length lookups (in real code from referenceRegions/currentRegions)
refLen=qlen   # x axis = refRefName lengths
qryLen=tlen   # y axis = queryRefName lengths
refNames=sorted({a["refRefName"] for a in alns})
qryNames=sorted({a["queryRefName"] for a in alns})

# ---------------------------------------------------------------------------
# This block mirrors the intended TS diagonalizeRegionsBothAxes exactly.
# axisA = reference (x, refRefName), axisB = query (y, queryRefName).
# ---------------------------------------------------------------------------
def build_pairs(alns):
    # pair[(a,b)] = bases, weighted posA, weighted posB, signed strand bases
    pair=defaultdict(lambda:{"bases":0,"posA":0.0,"posB":0.0,"str":0})
    for a in alns:
        w=a["refEnd"]-a["refStart"]
        key=(a["refRefName"],a["queryRefName"])
        d=pair[key]
        d["bases"]+=w
        d["posA"]+=((a["refStart"]+a["refEnd"])/2)*w
        d["posB"]+=((a["queryStart"]+a["queryEnd"])/2)*w
        d["str"]+=a["strand"]*w
    return pair

def span_order(anchorNames, otherNames, pair, anchorIsA):
    # iterate anchor seqs by total bases desc; append each anchor's unplaced
    # partners ordered by their mean position ALONG the anchor seq
    anchorBases=defaultdict(float); byAnchor=defaultdict(list)
    for (a,b),d in pair.items():
        anchor = a if anchorIsA else b
        other  = b if anchorIsA else a
        anchorBases[anchor]+=d["bases"]
        # position of `other` along `anchor` = mean anchor-axis pos
        posAlong = (d["posA"] if anchorIsA else d["posB"])/d["bases"]
        byAnchor[anchor].append((other,posAlong,d["bases"]))
    placed=set(); order=[]
    for anchor in sorted(anchorNames,key=lambda x:-anchorBases[x]):
        parts=sorted(byAnchor[anchor],key=lambda x:x[1])
        for other,_,_ in parts:
            if other not in placed:
                placed.add(other); order.append(other)
    for o in otherNames:  # unplaced (no alignments) appended
        if o not in placed: order.append(o)
    return order

def anchor_partner_order(anchorNames, otherNames, pair, anchorIsA):
    # given anchor order fixed as span produces the OTHER order; we then also
    # order the anchor axis by barycenter of the other axis's index
    other_order = span_order(anchorNames, otherNames, pair, anchorIsA)
    otherPos={n:i for i,n in enumerate(other_order)}
    def akey(anchor):
        num=den=0.0
        for (a,b),d in pair.items():
            an=a if anchorIsA else b; ot=b if anchorIsA else a
            if an==anchor:
                num+=otherPos[ot]*d["bases"]; den+=d["bases"]
        return num/den if den else 1e9
    anchor_order=sorted(anchorNames,key=akey)
    return anchor_order, other_order

def diag_metric(refOrder,qryOrder):
    xoff={};acc=0
    for n in refOrder: xoff[n]=acc; acc+=refLen[n]
    xt=acc
    yoff={};acc=0
    for n in qryOrder: yoff[n]=acc; acc+=qryLen[n]
    yt=acc
    num=den=0.0
    for a in alns:
        w=a["refEnd"]-a["refStart"]
        xf=(xoff[a["refRefName"]]+(a["refStart"]+a["refEnd"])/2)/xt
        yf=(yoff[a["queryRefName"]]+(a["queryStart"]+a["queryEnd"])/2)/yt
        num+=abs(xf-yf)*w; den+=w
    return num/den

pair=build_pairs(alns)
# candidate 1: anchor on reference axis (A)
refO1, qryO1 = anchor_partner_order(refNames, qryNames, pair, anchorIsA=True)
# candidate 2: anchor on query axis (B)
qryO2, refO2 = anchor_partner_order(qryNames, refNames, pair, anchorIsA=False)
m1=diag_metric(refO1,qryO1); m2=diag_metric(refO2,qryO2)
print(f"anchor=reference: {m1:.4f}   anchor=query: {m2:.4f}")
best = (refO1,qryO1) if m1<=m2 else (refO2,qryO2)
print(f"chosen metric: {diag_metric(*best):.4f}   (current single-axis ~0.104)")
