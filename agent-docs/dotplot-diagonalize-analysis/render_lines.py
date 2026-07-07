import gzip
from collections import defaultdict
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

alns=[];qlen={};tlen={}
for line in gzip.open("hap1.pif.gz","rt"):
    f=line.rstrip("\n").split("\t")
    if not f[0].startswith("q"): continue
    q=f[0][1:]; qlen[q]=int(f[1]); tlen[f[5]]=int(f[6])
    alns.append((q,int(f[2]),int(f[3]),1 if f[4]=="+" else -1,f[5],int(f[7]),int(f[8])))
qkeep=sorted({a[0] for a in alns}); tkeep=sorted({a[4] for a in alns})
pair=defaultdict(lambda:{"bases":0,"posA":0.0,"posB":0.0,"str":0})
for q,qs,qe,st,t,ts,te in alns:
    w=qe-qs; d=pair[(q,t)]
    d["bases"]+=w; d["posA"]+=((qs+qe)/2)*w; d["posB"]+=((ts+te)/2)*w; d["str"]+=st*w

def best(dm): return max(dm.items(),key=lambda kv:kv[1]["bases"])[0]
def qrev_by_bestpair(queryAxisNames, queryIsT):
    # reverse a query seq if the strand of its heaviest pair is negative
    rev={}
    for n in queryAxisNames:
        bpb=-1; bs=0
        for (a,b),d in pair.items():
            key=b if queryIsT else a
            if key==n and d["bases"]>bpb: bpb=d["bases"]; bs=d["str"]
        rev[n]= bs<0
    return rev

# ---- ORIGINAL single-axis: x=hap1 numeric fixed; y=GRCh38 reordered ----
xO=sorted(qkeep)
xpO={q:i for i,q in enumerate(xO)}
# each t placed by x-index of its best q, then by weighted x pos
def tkeyO(t):
    bq=None;bb=0
    for (a,b),d in pair.items():
        if b==t and d["bases"]>bb: bb=d["bases"]; bq=a
    return (xpO.get(bq,1e9),)
yO=sorted(tkeep,key=tkeyO)
revO=qrev_by_bestpair(tkeep,True)  # reverse GRCh38 (y)

# ---- MY both-axis (full-set anchor B, reproduced) ----
def spanOrder(anc,oth,isRef):
    ab=defaultdict(float); by=defaultdict(list)
    for (a,b),d in pair.items():
        A=a if isRef else b; O=b if isRef else a
        ab[A]+=d["bases"]; by[A].append((O,(d["posA"] if isRef else d["posB"])/d["bases"]))
    pl=set(); o=[]
    for A in sorted(anc,key=lambda x:-ab[x]):
        for O,_ in sorted(by[A],key=lambda x:x[1]):
            if O not in pl: pl.add(O); o.append(O)
    for n in oth:
        if n not in pl: o.append(n)
    return o
def baryO(anc,oo,isRef):
    op={n:i for i,n in enumerate(oo)}; num=defaultdict(float); den=defaultdict(float)
    for (a,b),d in pair.items():
        A=a if isRef else b; O=b if isRef else a
        num[A]+=op.get(O,0)*d["bases"]; den[A]+=d["bases"]
    return sorted(anc,key=lambda n:(num[n]/den[n]) if den[n] else 1e9)
qB=spanOrder(tkeep,qkeep,False); tB=baryO(tkeep,qB,False)
xM,yM=qB,tB; revM=qrev_by_bestpair(tkeep,True)

# ---- Option C: x=hap1 reordered, y=GRCh38 karyotype fixed; reverse x(hap1) ----
def karyo(n):
    c=n.replace("chr","").split("_")[0]
    o={str(i):i for i in range(1,23)}; o.update({"X":23,"Y":24,"M":25})
    return o.get(c,100)
yC=sorted(tkeep,key=karyo); ypC={t:i for i,t in enumerate(yC)}
def xkeyC(q):
    bt=None;bb=0
    for (a,b),d in pair.items():
        if a==q and d["bases"]>bb: bb=d["bases"]; bt=b
    return (ypC.get(bt,1e9),)
xC=sorted(qkeep,key=xkeyC)
revC=qrev_by_bestpair(qkeep,False)  # reverse hap1 (x) since it's the reordered axis

def render(ax,xo,yo,rev,revIsQuery_t,title):
    xoff={};acc=0
    for k in xo: xoff[k]=acc; acc+=qlen[k]
    xt=acc
    yoff={};acc=0
    for k in yo: yoff[k]=acc; acc+=tlen[k]
    yt=acc
    for q,qs,qe,st,t,ts,te in alns:
        x1=xoff[q]+qs; x2=xoff[q]+qe
        y1=yoff[t]+ts; y2=yoff[t]+te
        # apply reverse on the appropriate axis
        if revIsQuery_t and rev.get(t):
            y1=yoff[t]+(tlen[t]-ts); y2=yoff[t]+(tlen[t]-te)
        if (not revIsQuery_t) and rev.get(q):
            x1=xoff[q]+(qlen[q]-qs); x2=xoff[q]+(qlen[q]-qe)
        # forward strand: draw as is; the strand sign already in coords
        if st<0:
            y1,y2=y2,y1
        ax.plot([x1,x2],[y1,y2],'-',color="#111",lw=0.35,alpha=0.6)
    ax.set_xlim(0,xt);ax.set_ylim(0,yt); ax.set_title(title,fontsize=9)
    ax.set_xticks([]); ax.set_yticks([])

fig,ax=plt.subplots(1,3,figsize=(21,7))
render(ax[0],xO,yO,revO,True,"ORIGINAL single-axis (reorder GRCh38 y)")
render(ax[1],xM,yM,revM,True,"MY both-axis (shipped)")
render(ax[2],xC,yC,revC,False,"Option C (reorder hap1 x, GRCh38 karyotype)")
plt.tight_layout(); plt.savefig("render_lines.png",dpi=110); print("wrote render_lines.png")
