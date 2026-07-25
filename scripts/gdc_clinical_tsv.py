#!/usr/bin/env python3
"""Fetch a GDC project's open clinical annotations and write the samples TSV
that JBrowse's VCF adapters read (`samplesTsvLocation`), so cohort rows can be
grouped, colored, and labeled by clinical subtype instead of by barcode.

One row per primary-tumor sample barcode (TCGA-3C-AAAU-01A), which is the name
both the cohort VCF built by build_tcga_somatic_mutations.sh and the cohort BED
built by build_tcga_cohort_cnv.sh use for a tumor.

Two GDC clinical sources are folded in:

- `diagnoses.primary_diagnosis`, an ICD-O morphology string, collapsed to
  ductal / lobular / mixed / other. A case with both a ductal and a lobular
  diagnosis is `mixed`, not whichever came first.
- `follow_ups.molecular_tests`, one row per assay, which is where ER (ESR1),
  PR (PGR) and HER2 (ERBB2) receptor status lives. A case usually has several
  ERBB2 rows (an IHC call plus FISH copy-number rows that carry no
  positive/negative verdict), so status is resolved as positive if any assay
  called positive, else negative if any called negative, else equivocal. That
  is a summary of the assays, not a curated clinical call.

Requires: curl-free, uses urllib. Usage:
    gdc_clinical_tsv.py [PROJECT] [OUT.tsv]
"""
import json
import sys
import urllib.request

API = "https://api.gdc.cancer.gov/cases"
FIELDS = ",".join([
    "submitter_id",
    "diagnoses.primary_diagnosis",
    "diagnoses.ajcc_pathologic_stage",
    "follow_ups.molecular_tests.gene_symbol",
    "follow_ups.molecular_tests.test_result",
    "samples.submitter_id",
    "samples.sample_type",
])
RECEPTORS = {"ESR1": "er", "PGR": "pr", "ERBB2": "her2"}


def fetch(project):
    body = json.dumps({
        "filters": {"op": "in", "content": {"field": "project.project_id", "value": [project]}},
        "fields": FIELDS,
        "format": "JSON",
        "size": "20000",
    }).encode()
    req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as fh:
        return json.load(fh)["data"]["hits"]


def histology(case):
    text = " ".join(d.get("primary_diagnosis", "") for d in case.get("diagnoses") or []).lower()
    duct = "duct" in text
    lob = "lobular" in text
    if duct and lob:
        return "mixed"
    if duct:
        return "ductal"
    if lob:
        return "lobular"
    return "other"


def receptor_status(case):
    """gene -> positive/negative/equivocal from every molecular test on the case."""
    results = {}
    for follow_up in case.get("follow_ups") or []:
        for test in follow_up.get("molecular_tests") or []:
            gene = test.get("gene_symbol")
            if gene in RECEPTORS:
                results.setdefault(gene, set()).add(test.get("test_result"))
    status = {}
    for gene, seen in results.items():
        if "Positive" in seen:
            status[gene] = "positive"
        elif "Negative" in seen:
            status[gene] = "negative"
        elif "Equivocal" in seen:
            status[gene] = "equivocal"
    return status


def stage(case):
    for diagnosis in case.get("diagnoses") or []:
        value = diagnosis.get("ajcc_pathologic_stage")
        if value:
            # "Stage IIIA" -> "III": the substages split 1000 tumors into a
            # dozen thin groups, which is not a grouping anyone can read
            roman = value.replace("Stage ", "").rstrip("ABC")
            return roman or "unknown"
    return "unknown"


def subtype(status):
    """The receptor triple as one label, since that is how the cohort is read."""
    er, pr, her2 = (status.get(g) for g in ("ESR1", "PGR", "ERBB2"))
    if her2 == "positive":
        return "HER2+"
    if er == "positive" or pr == "positive":
        return "HR+/HER2-"
    if er == "negative" and pr == "negative" and her2 == "negative":
        return "triple-negative"
    return "unknown"


def main(argv):
    project = argv[0] if argv else "TCGA-BRCA"
    out = argv[1] if len(argv) > 1 else "clinical_samples.tsv"
    cases = fetch(project)

    rows = []
    for case in cases:
        status = receptor_status(case)
        values = {
            "histology": histology(case),
            "er": status.get("ESR1", "unknown"),
            "pr": status.get("PGR", "unknown"),
            "her2": status.get("ERBB2", "unknown"),
            "subtype": subtype(status),
            "stage": stage(case),
        }
        for sample in case.get("samples") or []:
            if sample.get("sample_type") == "Primary Tumor":
                rows.append((sample["submitter_id"], values))

    rows.sort()
    columns = ["histology", "er", "pr", "her2", "subtype", "stage"]
    with open(out, "w") as fh:
        fh.write("name\t" + "\t".join(columns) + "\n")
        for name, values in rows:
            fh.write(name + "\t" + "\t".join(values[c] for c in columns) + "\n")
    print(f"   {len(rows)} primary-tumor samples from {len(cases)} {project} cases -> {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
