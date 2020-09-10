/* eslint-disable */
import gff from '@gmod/gff'

const scoreTestPattern = [
  100,
  150,
  200,
  2,
  1,
  1,
  1,
  1,
  1,
  1000,
  4,
  8,
  16,
  22,
  240,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  100,
  150,
  200,
  2,
  1,
  1,
  1,
  1,
  1,
  1000,
  4,
  8,
  16,
  22,
  240,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  100,
  150,
  200,
  2,
  1,
  1,
  1,
  1,
  1,
  1000,
  4,
  8,
  16,
  22,
  240,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  100,
  150,
  200,
  2,
  1,
  1,
  1,
  1,
  1,
  1000,
  4,
  8,
  16,
  22,
  240,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  100,
  150,
  200,
  2,
  1,
  1,
  1,
  1,
  1,
  1000,
  4,
  8,
  16,
  22,
  240,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
  1,
]
const gffString = `##gff-version 3
##sequence-region P01116 1 189
P01116	UniProtKB	Chain	1	186	.	.	.	ID=PRO_0000082641;Note=GTPase KRas
P01116	UniProtKB	Initiator methionine	1	1	.	.	.	Note=Removed%3B alternate;Ontology_term=ECO:0000269;evidence=ECO:0000269|Ref.17
P01116	UniProtKB	Chain	2	186	.	.	.	ID=PRO_0000326480;Note=GTPase KRas%2C N-terminally processed
P01116	UniProtKB	Propeptide	187	189	.	.	.	ID=PRO_0000281291;Note=Removed in mature form
P01116	UniProtKB	Nucleotide binding	10	18	.	.	.	Note=GTP;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:22431598,ECO:0000269|PubMed:22566140;Dbxref=PMID:22431598,PMID:22566140
P01116	UniProtKB	Nucleotide binding	29	35	.	.	.	Note=GTP;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:22431598,ECO:0000269|PubMed:22566140;Dbxref=PMID:22431598,PMID:22566140
P01116	UniProtKB	Nucleotide binding	59	60	.	.	.	Note=GTP;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:22431598,ECO:0000269|PubMed:22566140;Dbxref=PMID:22431598,PMID:22566140
P01116	UniProtKB	Nucleotide binding	116	119	.	.	.	Note=GTP;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:22431598,ECO:0000269|PubMed:22566140;Dbxref=PMID:22431598,PMID:22566140
P01116	UniProtKB	Region	166	185	.	.	.	Note=Hypervariable region
P01116	UniProtKB	Motif	32	40	.	.	.	Note=Effector region
P01116	UniProtKB	Modified residue	1	1	.	.	.	Note=N-acetylmethionine%3B in GTPase KRas%3B alternate;Ontology_term=ECO:0000269;evidence=ECO:0000269|Ref.17
P01116	UniProtKB	Modified residue	2	2	.	.	.	Note=N-acetylthreonine%3B in GTPase KRas%2C N-terminally processed;Ontology_term=ECO:0000269;evidence=ECO:0000269|Ref.17
P01116	UniProtKB	Modified residue	104	104	.	.	.	Note=N6-acetyllysine;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:22711838;Dbxref=PMID:22711838
P01116	UniProtKB	Modified residue	186	186	.	.	.	Note=Cysteine methyl ester;Ontology_term=ECO:0000244,ECO:0000244,ECO:0000269;evidence=ECO:0000244|PDB:5TAR,ECO:0000244|PDB:5TB5,ECO:0000269|PubMed:27791178;Dbxref=PMID:27791178
P01116	UniProtKB	Lipidation	180	180	.	.	.	Note=S-palmitoyl cysteine;Ontology_term=ECO:0000250;evidence=ECO:0000250
P01116	UniProtKB	Lipidation	186	186	.	.	.	Note=S-farnesyl cysteine;Ontology_term=ECO:0000244,ECO:0000244,ECO:0000269;evidence=ECO:0000244|PDB:5TAR,ECO:0000244|PDB:5TB5,ECO:0000269|PubMed:27791178;Dbxref=PMID:27791178
P01116	UniProtKB	Cross-link	170	170	.	.	.	Note=Glycyl lysine isopeptide (Lys-Gly) (interchain with G-Cter in ubiquitin);Ontology_term=ECO:0000305;evidence=ECO:0000305|PubMed:30442762;Dbxref=PMID:30442762
P01116	UniProtKB	Alternative sequence	151	153	.	.	.	ID=VSP_011140;Note=In isoform 2B. RVE->GVD;Ontology_term=ECO:0000303,ECO:0000303,ECO:0000303,ECO:0000303,ECO:0000303;evidence=ECO:0000303|PubMed:14702039,ECO:0000303|PubMed:15489334,ECO:0000303|PubMed:3310850,ECO:0000303|Ref.6,ECO:0000303|Ref.7;Dbxref=PMID:14702039,PMID:15489334,PMID:3310850
P01116	UniProtKB	Alternative sequence	165	189	.	.	.	ID=VSP_011141;Note=In isoform 2B. QYRLKKISKEEKTPGCVKIKKCIIM->KHKEKMSKDGKKKKKKSKTKCVIM;Ontology_term=ECO:0000303,ECO:0000303,ECO:0000303,ECO:0000303,ECO:0000303;evidence=ECO:0000303|PubMed:14702039,ECO:0000303|PubMed:15489334,ECO:0000303|PubMed:3310850,ECO:0000303|Ref.6,ECO:0000303|Ref.7;Dbxref=PMID:14702039,PMID:15489334,PMID:3310850
P01116	UniProtKB	Natural variant	5	5	.	.	.	ID=VAR_065144;Note=In NS3. K->E;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:17468812;Dbxref=dbSNP:rs193929331,PMID:17468812
P01116	UniProtKB	Natural variant	5	5	.	.	.	ID=VAR_064849;Note=In GASC%3B found also in a patient with Costello syndrome%3B exhibits only minor alterations in its in vitro biochemical behavior compared to wild-type protein. K->N;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:14534542;Dbxref=dbSNP:rs104894361,PMID:14534542
P01116	UniProtKB	Natural variant	10	10	.	.	.	ID=VAR_034601;Note=In AML%3B expression in 3T3 cell causes cellular transformation%3B expression in COS cells activates the Ras-MAPK signaling pathway%3B lower GTPase activity%3B faster GDP dissociation rate. G->GG;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:8955068;Dbxref=PMID:8955068
P01116	UniProtKB	Natural variant	12	12	.	.	.	ID=VAR_036305;Note=In a colorectal cancer sample%3B somatic mutation. G->A;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:16959974;Dbxref=dbSNP:rs121913529,PMID:16959974
P01116	UniProtKB	Natural variant	12	12	.	.	.	ID=VAR_006839;Note=In lung carcinoma%3B somatic mutation. G->C;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:16533793,ECO:0000269|PubMed:6320174;Dbxref=dbSNP:rs121913530,PMID:16533793,PMID:6320174
P01116	UniProtKB	Natural variant	12	12	.	.	.	ID=VAR_016026;Note=In GASC and JMML%3B also found in pancreatic carcinoma and lung carcinoma%3B somatic mutation. G->D;Ontology_term=ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:16533793,ECO:0000269|PubMed:16959974,ECO:0000269|PubMed:17332249,ECO:0000269|PubMed:7773929,ECO:0000269|PubMed:8439212;Dbxref=dbSNP:rs121913529,PMID:16533793,PMID:16959974,PMID:17332249,PMID:7773929,PMID:8439212
P01116	UniProtKB	Natural variant	12	12	.	.	.	ID=VAR_016027;Note=In lung cancer and bladder cancer%3B somatic mutation. G->R;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:6695174;Dbxref=dbSNP:rs121913530,PMID:6695174
P01116	UniProtKB	Natural variant	12	12	.	.	.	ID=VAR_016028;Note=In GASC and JMML%3B also found in lung carcinoma%3B somatic mutation. G->S;Ontology_term=ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:16533793,ECO:0000269|PubMed:16959974,ECO:0000269|PubMed:17332249,ECO:0000269|PubMed:7773929;Dbxref=dbSNP:rs121913530,PMID:16533793,PMID:16959974,PMID:17332249,PMID:7773929
P01116	UniProtKB	Natural variant	12	12	.	.	.	ID=VAR_006840;Note=In GASC%3B also found in lung carcinoma%2C pancreatic carcinoma and colon cancer%3B somatic mutation%3B it is constitutively activated and stimulates transcription activation of tumor suppressor genes in non-transformed fibroblasts. G->V;Ontology_term=ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:14534542,ECO:0000269|PubMed:16533793,ECO:0000269|PubMed:16959974,ECO:0000269|PubMed:22711838,ECO:0000269|PubMed:24623306,ECO:0000269|PubMed:3034404,ECO:0000269|PubMed:6092920,ECO:0000269|PubMed:8439212;Dbxref=dbSNP:rs121913529,PMID:14534542,PMID:16533793,PMID:16959974,PMID:22711838,PMID:24623306,PMID:3034404,PMID:6092920,PMID:8439212
P01116	UniProtKB	Natural variant	13	13	.	.	.	ID=VAR_016029;Note=In GASC and JMML%3B also found in a breast carcinoma cell line%3B somatic mutation. G->D;Ontology_term=ECO:0000269,ECO:0000269,ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:14534542,ECO:0000269|PubMed:16959974,ECO:0000269|PubMed:17332249,ECO:0000269|PubMed:3627975;Dbxref=dbSNP:rs112445441,PMID:14534542,PMID:16959974,PMID:17332249,PMID:3627975
P01116	UniProtKB	Natural variant	13	13	.	.	.	ID=VAR_065145;Note=In pylocytic astrocytoma%3B somatic mutation%3B increase activation of the Ras pathway. G->R;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:16247081;Dbxref=dbSNP:rs121913535,PMID:16247081
P01116	UniProtKB	Natural variant	14	14	.	.	.	ID=VAR_026109;Note=In NS3%3B affects activity and impairs responsiveness to GTPase activating proteins%3B characterized by a strong increase of both intrinsic and guanine nucleotide exchanged factor-catalyzed nucleotide exchange leading to an increased level of the activated state. V->I;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:16474405;Dbxref=dbSNP:rs104894365,PMID:16474405
P01116	UniProtKB	Natural variant	22	22	.	.	.	ID=VAR_064850;Note=In CFC2%3B exhibits an increase in intrinsic and guanine nucleotide exchange factor catalyzed nucleotide exchange in combination with an impaired GTPase-activating protein-stimulated GTP hydrolysis but functional in interaction with effectors. Q->E;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:17056636,ECO:0000269|PubMed:20949621;Dbxref=PMID:17056636,PMID:20949621
P01116	UniProtKB	Natural variant	22	22	.	.	.	ID=VAR_064851;Note=In NS3%3B impairs GTPase-activating protein stimulated GTP hydrolysis with unaffected intrinsic functions and a virtually functional effector interaction. Q->R;Dbxref=dbSNP:rs727503110
P01116	UniProtKB	Natural variant	34	34	.	.	.	ID=VAR_064852;Note=In NS3%3B characterized by a defective GTPase-activating protein sensitivity and a strongly reduced interaction with effectors. P->L;Dbxref=dbSNP:rs104894366
P01116	UniProtKB	Natural variant	34	34	.	.	.	ID=VAR_064853;Note=In NS3. P->Q
P01116	UniProtKB	Natural variant	34	34	.	.	.	ID=VAR_026110;Note=In CFC2%3B characterized by a defective GTPase-activating protein sensitivity and a strongly reduced interaction with effectors. P->R;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:16474405,ECO:0000269|PubMed:20949621;Dbxref=dbSNP:rs104894366,PMID:16474405,PMID:20949621
P01116	UniProtKB	Natural variant	36	36	.	.	.	ID=VAR_064854;Note=In NS3. I->M;Dbxref=dbSNP:rs727503109
P01116	UniProtKB	Natural variant	58	58	.	.	.	ID=VAR_026111;Note=In NS3%3B affects activity and impairs responsiveness to GTPase activating proteins%3B exhibits only minor alterations in its in vitro biochemical behavior compared to wild-type protein. T->I;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:16474405,ECO:0000269|PubMed:19396835;Dbxref=dbSNP:rs104894364,PMID:16474405,PMID:19396835
P01116	UniProtKB	Natural variant	59	59	.	.	.	ID=VAR_016030;Note=In GASC%3B also found in bladder cancer%3B somatic mutation. A->T;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:14534542,ECO:0000269|PubMed:1553789;Dbxref=dbSNP:rs121913528,PMID:14534542,PMID:1553789
P01116	UniProtKB	Natural variant	60	60	.	.	.	ID=VAR_026112;Note=In CFC2%3B characterized by a defective GTPase-activating protein sensitivity and a strongly reduced interaction with effectors. G->R;Ontology_term=ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:16474404,ECO:0000269|PubMed:20949621;Dbxref=dbSNP:rs104894359,PMID:16474404,PMID:20949621
P01116	UniProtKB	Natural variant	60	60	.	.	.	ID=VAR_065146;Note=In NS3. G->S;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:19396835;Dbxref=dbSNP:rs104894359,PMID:19396835
P01116	UniProtKB	Natural variant	61	61	.	.	.	ID=VAR_006841;Note=In lung carcinoma. Q->H;Ontology_term=ECO:0000269,ECO:0000269,ECO:0000269;evidence=ECO:0000269|PubMed:15489334,ECO:0000269|PubMed:16533793,ECO:0000269|Ref.7;Dbxref=dbSNP:rs17851045,PMID:15489334,PMID:16533793
P01116	UniProtKB	Natural variant	61	61	.	.	.	ID=VAR_036306;Note=In a colorectal cancer sample%3B somatic mutation. Q->R;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:16959974;Dbxref=dbSNP:rs121913240,PMID:16959974
P01116	UniProtKB	Natural variant	71	71	.	.	.	ID=VAR_069784;Note=In CFC2. Y->H;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:21797849;Dbxref=dbSNP:rs387907205,PMID:21797849
P01116	UniProtKB	Natural variant	117	117	.	.	.	ID=VAR_036307;Note=In a colorectal cancer sample%3B somatic mutation. K->N;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:16959974;Dbxref=dbSNP:rs770248150,PMID:16959974
P01116	UniProtKB	Natural variant	146	146	.	.	.	ID=VAR_036308;Note=In a colorectal cancer sample%3B somatic mutation. A->T;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:16959974;Dbxref=dbSNP:rs121913527,PMID:16959974
P01116	UniProtKB	Natural variant	147	147	.	.	.	ID=VAR_069785;Note=In CFC2. K->E;Ontology_term=ECO:0000269;evidence=ECO:0000269|PubMed:21797849;Dbxref=dbSNP:rs387907206,PMID:21797849
P01116	UniProtKB	Mutagenesis	164	164	.	.	.	Note=Loss of GTP-binding activity. R->A
P01116	UniProtKB	Beta strand	3	9	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Helix	16	25	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Beta strand	27	30	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:6ASE
P01116	UniProtKB	Beta strand	38	46	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Beta strand	49	57	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Helix	60	62	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4Q01
P01116	UniProtKB	Helix	65	74	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Beta strand	76	83	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Helix	87	91	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Helix	93	104	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Beta strand	105	107	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:5VBM
P01116	UniProtKB	Beta strand	111	116	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Beta strand	120	122	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4OBE
P01116	UniProtKB	Helix	127	137	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Beta strand	141	143	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Turn	146	148	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Helix	152	167	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4QL3
P01116	UniProtKB	Helix	169	172	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:5OCG
P01116	UniProtKB	Beta strand	175	177	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:4DSN
P01116	UniProtKB	Beta strand	182	184	.	.	.	Ontology_term=ECO:0000244;evidence=ECO:0000244|PDB:5TB5	`

const arrayOfThings = gff.parseStringSync(gffString)
export const variants = arrayOfThings
  .filter(([f]) => f.type === 'Natural variant')
  .map(([f]) => ({
    uniqueId: f.attributes.ID[0],
    start: f.start,
    end: f.end + 1,
    refName: 'KRAS 2A',
    note: f.attributes.Note[0],
    score: scoreTestPattern.shift(),
  }))

let idCounter = 0
export const domains = arrayOfThings
  .filter(([f]) => f.type !== 'Natural variant')
  .map(([f]) => ({
    uniqueId: f.attributes.ID ? f.attributes.ID[0] : `${f.type}-${idCounter++}`,
    start: f.start,
    end: f.end + 1,
    refName: 'KRAS 2A',
    type: f.type,
    note: f.attributes.Note && f.attributes.Note[0],
    score: scoreTestPattern.shift(),
  }))

console.log(JSON.stringify(domains))
