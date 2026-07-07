import gzip
from collections import defaultdict

alns=[];qlen={};tlen={}
for line in gzip.open("hap1.pif.gz","rt"):
    f=line.rstrip("\n").split("\t")
    if not f[0].startswith("q"): continue
    q=f[0][1:]; qlen[q]=int(f[1]); tlen[f[5]]=int(f[6])
    alns.append((q,int(f[2]),int(f[3]),f[4],f[5],int(f[7]),int(f[8])))
MIN=5_000_000
alns=[a for a in alns if qlen[a[0]]>=MIN and tlen[a[4]]>=MIN]
qkeep=sorted({a[0] for a in alns}); tkeep=sorted({a[4] for a in alns})

# pair stats keyed (q,t): bases, weighted mean q-pos & t-pos, signed strand bases
pair=defaultdict(lambda: {"bases":0,"qpos":0.0,"tpos":0.0,"str":0})
qbases=defaultdict(int); tbases=defaultdict(int)
for q,qs,qe,st,t,ts,te in alns:
    w=qe-qs
    d=pair[(q,t)]
    d["bases"]+=w; d["qpos"]+=((qs+qe)/2)*w; d["tpos"]+=((ts+te)/2)*w
    d["str"]+=(1 if st=="+" else -1)*w
    qbases[q]+=w; tbases[t]+=w

def metric(qo,to):
    xoff={};acc=0
    for k in qo: xoff[k]=acc; acc+=qlen[k]
    xt=acc
    yoff={};acc=0
    for k in to: yoff[k]=acc; acc+=tlen[k]
    yt=acc
    num=den=0.0
    for q,qs,qe,st,t,ts,te in alns:
        w=qe-qs
        num+=abs((xoff[q]+(qs+qe)/2)/xt-(yoff[t]+(ts+te)/2)/yt)*w; den+=w
    return num/den

# Greedy spanning (mummerplot-style):
#  - process one axis's seqs largest-first (by aligned bases)
#  - for each, append its still-unplaced partners on the other axis, ordered by
#    their mean position ALONG this seq -> contiguous placement chains splits
#  - then order the first axis by the resulting partner-index barycenter
def span(primary, prim_bases, order_within):
    # primary: list of names to iterate (the axis we anchor on)
    placed=set(); partner_order=[]
    for p in sorted(primary, key=lambda x:-prim_bases[x]):
        parts=[]
        for (q,t),d in pair.items():
            key = t if primary is tkeep else q
            partner = q if primary is tkeep else t
            if key==p and partner not in placed and d["bases"]>0:
                parts.append((partner, order_within(q,t)))
        parts.sort(key=lambda x:x[1])
        for partner,_ in parts:
            if partner not in placed:
                placed.add(partner); partner_order.append(partner)
    return partner_order

# anchor on reference (t), order its queries by position along t (tpos)
q_order = span(tkeep, tbases, lambda q,t: pair[(q,t)]["tpos"]/pair[(q,t)]["bases"])
# add any unplaced queries
for q in qkeep:
    if q not in q_order: q_order.append(q)
qpos={q:i for i,q in enumerate(q_order)}
# order refs by barycenter of query index (weighted)
def tkey(t):
    num=den=0.0
    for q in q_order:
        b=pair.get((q,t),{}).get("bases",0)
        if b: num+=qpos[q]*b; den+=b
    return num/den if den else 1e9
t_order=sorted(tkeep,key=tkey)
print("span(anchor=ref): metric",round(metric(q_order,t_order),4))

# symmetric: anchor on query, order refs
t_order2 = span(qkeep, qbases, lambda q,t: pair[(q,t)]["qpos"]/pair[(q,t)]["bases"])
for t in tkeep:
    if t not in t_order2: t_order2.append(t)
tpos2={t:i for i,t in enumerate(t_order2)}
def qkey(q):
    num=den=0.0
    for t in t_order2:
        b=pair.get((q,t),{}).get("bases",0)
        if b: num+=tpos2[t]*b; den+=b
    return num/den if den else 1e9
q_order2=sorted(qkeep,key=qkey)
print("span(anchor=query): metric",round(metric(q_order2,t_order2),4))

print("\nq order (anchor=ref):", [x.replace('haplotype1-0000','c') for x in q_order])
print("t order (anchor=ref):", t_order)
