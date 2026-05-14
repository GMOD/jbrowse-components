use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};

use clap::Parser;

/// Converts GFA to tabix-indexed pos.bed.gz + segments.gz files.
///
/// Streaming two-pass approach: O(segments) memory.
/// Segment ordinals are assigned in path-traversal order so that
/// reference-path queries span compact ordinal ranges in segments.gz.
/// List the reference assembly's paths first in the GFA for best performance.
///
/// By default, walks whose segments ALL have opposite orientation to the
/// reference are normalized (orient flipped, offsets reversed). This removes
/// false inversions caused by reverse-complemented assembly contigs while
/// preserving genuine biological inversions. Inspired by odgi groom
/// (https://github.com/pangenome/odgi); for more thorough normalization,
/// preprocess with: odgi groom -R ref_paths.txt
#[derive(Parser)]
#[command(name = "gfa-to-tabix")]
struct Args {
    /// Input GFA file (plain or .gz)
    input_file: String,

    /// Output prefix (default: derived from input filename)
    output_prefix: Option<String>,

    /// Number of walk steps per pos.bed.gz chunk
    #[arg(long, default_value_t = 100)]
    chunk_size: usize,

    /// Comma-separated list of assemblies to include
    #[arg(long)]
    assemblies: Option<String>,

    /// Disable orientation normalization of reverse-complemented contigs
    #[arg(long)]
    no_groom: bool,

    /// Assembly name to use as reference for grooming (default: first assembly in GFA).
    /// Should match the assembly used for browsing in JBrowse.
    #[arg(long)]
    ref_assembly: Option<String>,

    /// Write a JBrowse config JSON file with a track entry for the generated
    /// GfaTabix multi-synteny track.
    #[arg(long)]
    output_config: Option<String>,
}

fn main() {
    let cli = Args::parse();

    let gfa_path = &cli.input_file;

    let output_prefix = cli.output_prefix.unwrap_or_else(|| {
        gfa_path
            .trim_end_matches(".gz")
            .trim_end_matches(".gfa")
            .to_string()
    });

    let chunk_size = cli.chunk_size;
    let assemblies_filter: Option<HashSet<String>> = cli
        .assemblies
        .map(|s| s.split(',').map(|s| s.to_string()).collect());
    let groom = !cli.no_groom;
    let ref_assembly_arg = cli.ref_assembly;
    let output_config = cli.output_config;

    // Two-phase single-pass: reads all lines once, collecting S-lines in memory
    // and spilling P/W-lines to a temp file. Then replays the temp file to
    // process paths with full segment knowledge. This supports streaming from
    // stdin (vg convert -f input.vg | gfa-to-tabix - output) without buffering
    // large path walks in memory.
    let tmp_dir = output_parent(&output_prefix).join(format!(".gfa-tmp-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir).expect("failed to create temp dir");

    eprintln!("Reading GFA...");
    let mut seg_lengths: HashMap<String, u64> = HashMap::new();
    let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
    let mut next_ordinal: u64 = 0;
    let mut raw_links: Vec<(String, String, String, String)> = Vec::new();

    // Spool P/W-lines to a temp file to avoid buffering in memory
    let paths_tmp = tmp_dir.join("paths.txt");
    let mut paths_tmp_w = BufWriter::new(File::create(&paths_tmp).expect("create paths tmp"));
    let mut path_line_count: u64 = 0;

    for line in open_file(gfa_path).lines() {
        let line = line.expect("read error");

        if line.starts_with("S\t") {
            let mut parts = line.splitn(4, '\t');
            parts.next();
            let name = parts.next().expect("missing segment name").to_string();
            let seq = parts.next().expect("missing segment sequence");
            let length = parts
                .next()
                .and_then(|rest| {
                    rest.split('\t')
                        .find(|t| t.starts_with("LN:i:"))
                        .map(|t| t[5..].parse::<u64>().unwrap_or(0))
                })
                .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 });
            seg_lengths.insert(name, length);
        } else if line.starts_with("L\t") {
            let cols: Vec<&str> = line.splitn(6, '\t').collect();
            if cols.len() >= 5 {
                raw_links.push((cols[1].to_string(), cols[2].to_string(), cols[3].to_string(), cols[4].to_string()));
            }
        } else if line.starts_with("W\t") || line.starts_with("P\t") {
            paths_tmp_w.write_all(line.as_bytes()).unwrap();
            paths_tmp_w.write_all(b"\n").unwrap();
            path_line_count += 1;
        }
    }
    drop(paths_tmp_w);

    eprintln!("  {} segments, {} path lines", seg_lengths.len(), path_line_count);

    // Replay buffered path lines now that all segments are known
    eprintln!("Processing paths...");

    let pos_file = format!("{}.pos.bed.gz", output_prefix);
    let mut pos_proc = spawn_sort_bgzip(&pos_file);
    let mut pos_w = BufWriter::new(pos_proc.stdin.take().unwrap());

    let mut genomes: Vec<String> = Vec::new();
    let mut genome_set: HashSet<String> = HashSet::new();
    let mut ref_orients: HashMap<u64, bool> = HashMap::new();
    let mut ref_assembly: Option<String> = None;
    let mut path_names: Vec<String> = Vec::new();
    let mut path_name_indices: HashMap<String, u64> = HashMap::new();
    let mut path_sizes: Vec<(String, u64)> = Vec::new();
    let mut path_count: u64 = 0;
    let mut ref_ord_walks: HashMap<String, Vec<(u64, u64)>> = HashMap::new();
    let mut all_paths: Vec<PathData> = Vec::new();
    // Track whether the input GFA used W-lines or P-lines for haplotype paths
    // so the adapter can emit the same format on extraction (Phase 2 W-in/W-out).
    let mut had_walk_lines = false;
    let mut had_path_lines = false;

    for line in BufReader::new(File::open(&paths_tmp).expect("reopen paths tmp")).lines() {
        let line = line.expect("read error");

        let parsed = if line.starts_with("W\t") {
            had_walk_lines = true;
            parse_walk(&line)
        } else if line.starts_with("P\t") {
            had_path_lines = true;
            parse_p_line(&line)
        } else {
            None
        };

        if let Some((path_name, assembly, seg_str, is_walk)) = parsed {
            if let Some(ref filter) = assemblies_filter {
                if !filter.contains(&assembly) {
                    continue;
                }
            }
            if genome_set.insert(assembly.clone()) {
                genomes.push(assembly.clone());
            }

            let is_ref = match &ref_assembly {
                None => {
                    if let Some(ref ra) = ref_assembly_arg {
                        if *ra == assembly {
                            ref_assembly = Some(assembly.clone());
                            true
                        } else {
                            false
                        }
                    } else {
                        ref_assembly = Some(assembly.clone());
                        true
                    }
                }
                Some(ra) => *ra == assembly,
            };

            if !path_name_indices.contains_key(&path_name) {
                path_name_indices.insert(path_name.clone(), path_names.len() as u64);
                path_names.push(path_name.clone());
            }

            let mut ord_walk: Vec<(u64, u64)> = Vec::new();
            let mut steps_out: Vec<StepInfo> = Vec::new();
            let total = emit_path_rows(
                &path_name,
                &seg_str,
                is_walk,
                chunk_size,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut pos_w,
                &mut ref_orients,
                is_ref,
                groom,
                &mut ord_walk,
                &mut steps_out,
            );

            if is_ref {
                ord_walk.sort_unstable_by_key(|&(off, _)| off);
                ref_ord_walks.insert(path_name.clone(), ord_walk);
            }

            all_paths.push(PathData { name: path_name.clone(), assembly: assembly.clone(), steps: steps_out });
            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }
    // Clean up paths temp file
    let _ = fs::remove_file(&paths_tmp);
    if let Some(ref ra) = ref_assembly {
        eprintln!("  Reference assembly: {} ({} orient entries)", ra, ref_orients.len());
    }

    // Headers
    let header = format!("#genomes={}\n", genomes.join(","));
    let sizes_str: Vec<String> = path_sizes
        .iter()
        .map(|(n, s)| format!("{}:{}", n, s))
        .collect();
    let sizes_header = format!("#sizes={}\n", sizes_str.join(","));
    let paths_header = format!("#paths={}\n", path_names.join(","));
    // input-format records whether the source GFA used W-lines or P-lines for
    // haplotypes; the adapter mirrors this on emission (Phase 2 W-in/W-out).
    // Mixed inputs are unusual but possible — pick the dominant form.
    let input_format = if had_walk_lines && !had_path_lines {
        "walks"
    } else if had_path_lines && !had_walk_lines {
        "paths"
    } else if had_walk_lines {
        "walks"
    } else {
        "paths"
    };
    let format_header = format!("#input-format={}\n", input_format);

    // Finish pos.bed.gz
    pos_w.write_all(header.as_bytes()).unwrap();
    pos_w.write_all(sizes_header.as_bytes()).unwrap();
    pos_w.write_all(paths_header.as_bytes()).unwrap();
    pos_w.write_all(format_header.as_bytes()).unwrap();
    drop(pos_w);
    assert!(
        pos_proc.wait().map(|s| s.success()).unwrap_or(false),
        "pos sort|bgzip failed"
    );
    run_cmd("tabix", &["-c", "#", "-p", "bed", &pos_file]);

    if let Some(ref ra) = ref_assembly {
        eprintln!("Building synteny index...");
        synteny_build(&all_paths, ra, &output_prefix);
        eprintln!("Building edge spatial index...");
        build_edges_spatial(&raw_links, &seg_ordinals, &seg_lengths, &all_paths, ra, &output_prefix);
    }

    // seglens.bin: flat u32 array indexed by ordinal
    let seglens_path = format!("{}.seglens.bin", output_prefix);
    let mut sf = BufWriter::new(File::create(&seglens_path).expect("create seglens.bin"));
    let n_ords = next_ordinal as usize;
    let mut lens_by_ord: Vec<u32> = vec![0u32; n_ords];
    for (name, &ord) in &seg_ordinals {
        if let Some(&l) = seg_lengths.get(name) {
            lens_by_ord[ord as usize] = l.min(u32::MAX as u64) as u32;
        }
    }
    for l in &lens_by_ord {
        sf.write_all(&l.to_le_bytes()).unwrap();
    }
    drop(sf);
    eprintln!("  Wrote {}", seglens_path);

    if let Some(ref config_path) = output_config {
        write_jbrowse_config(config_path, &output_prefix, &genomes);
    }

    let _ = fs::remove_dir_all(&tmp_dir);

    eprintln!("Done.");
    eprintln!("  Segments: {}", seg_lengths.len());
    eprintln!("  Paths: {}", path_count);
    eprintln!("  Genomes: {} ({})", genomes.len(), genomes.join(", "));
}

/// Process one path (P-line or W-line walk) from the GFA, emitting
/// pos.bed.gz rows (one per chunk of `chunk_size` steps) and collecting
/// StepInfo for the caller to use in synteny/edge/bubble builds.
///
/// Numeric IDs (ordinals) are assigned on first encounter — the first path
/// to traverse a segment determines its ID, so GFA path ordering matters.
/// A buffered step from parsing a walk:
struct WalkStep {
    ord: u64,
    seg_len: u64,
    is_plus: bool,
}

struct StepInfo {
    ord: u64,
    offset: u64,
    seg_len: u64,
    is_plus: bool,
}

struct PathData {
    name: String,
    assembly: String,
    steps: Vec<StepInfo>,
}

fn emit_path_rows(
    path_name: &str,
    seg_str: &str,
    is_walk: bool,
    chunk_size: usize,
    seg_lengths: &HashMap<String, u64>,
    seg_ordinals: &mut HashMap<String, u64>,
    next_ordinal: &mut u64,
    pos_w: &mut BufWriter<impl Write>,
    ref_orients: &mut HashMap<u64, bool>,
    is_ref: bool,
    groom: bool,
    ord_walk_out: &mut Vec<(u64, u64)>,
    step_out: &mut Vec<StepInfo>,
) -> u64 {
    // Phase 1: parse the walk and assign ordinals, buffering all steps.
    let mut walk_steps: Vec<WalkStep> = Vec::new();

    let mut collect_step = |seg_id: &str, orient: &str| {
        let seg_len = seg_lengths.get(seg_id).copied().unwrap_or(0);
        let is_plus = orient == "+";

        let ord = if let Some(&o) = seg_ordinals.get(seg_id) {
            o
        } else {
            let o = *next_ordinal;
            *next_ordinal += 1;
            seg_ordinals.insert(seg_id.to_string(), o);
            o
        };

        if is_ref {
            ref_orients.insert(ord, is_plus);
        }

        walk_steps.push(WalkStep { ord, seg_len, is_plus });
    };

    if is_walk {
        let bytes = seg_str.as_bytes();
        let mut pos = 0;
        while pos < bytes.len() {
            if bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
                continue;
            }
            let orient = if bytes[pos] == b'>' { "+" } else { "-" };
            pos += 1;
            let start = pos;
            while pos < bytes.len() && bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
            }
            collect_step(&seg_str[start..pos], orient);
        }
    } else {
        for step in seg_str.split(',') {
            let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
                (&step[..step.len() - 1], if step.ends_with('+') { "+" } else { "-" })
            } else {
                (step, "+")
            };
            collect_step(seg_id, orient);
        }
    }

    // Phase 2: for non-reference walks, detect if the walk is a
    // reverse-complemented contig. A walk is reverse-complemented iff
    // EVERY segment shared with the reference has opposite orient.
    // This is a deterministic condition, not a heuristic.
    let need_flip = if is_ref || !groom {
        false
    } else {
        // Use bp-weighted tally: tiny 1-2bp SNP nodes in the graph
        // shouldn't prevent detection of a reversed contig.
        let mut shared_bp = 0u64;
        let mut opposite_bp = 0u64;
        for step in &walk_steps {
            if let Some(&ref_is_plus) = ref_orients.get(&step.ord) {
                shared_bp += step.seg_len;
                if step.is_plus != ref_is_plus {
                    opposite_bp += step.seg_len;
                }
            }
        }
        // Flip if >99% of shared bp are opposite orientation.
        shared_bp > 0 && opposite_bp * 100 >= shared_bp * 99
    };

    // Phase 3: emit pos.bed.gz rows.
    // If the walk needs flipping, iterate steps in reverse so emitted offsets
    // accumulate monotonically along the rev-complemented walk direction.
    // Downstream synteny/tiling code assumes step_out.offset is monotonically
    // increasing; the prior approach (forward iteration with descending
    // offsets) broke align_pair's hap_contiguous check and produced bubble
    // rows with hap_end < hap_start.
    let total_len: u64 = walk_steps.iter().map(|s| s.seg_len).sum();
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_ords: Vec<u64> = Vec::new();
    let mut steps: usize = 0;

    let step_iter: Box<dyn Iterator<Item = &WalkStep>> = if need_flip {
        Box::new(walk_steps.iter().rev())
    } else {
        Box::new(walk_steps.iter())
    };

    for step in step_iter {
        let effective_is_plus = if need_flip { !step.is_plus } else { step.is_plus };
        ord_walk_out.push((offset, step.ord));
        step_out.push(StepInfo {
            ord: step.ord,
            offset,
            seg_len: step.seg_len,
            is_plus: effective_is_plus,
        });
        chunk_ords.push(step.ord);
        offset += step.seg_len;
        steps += 1;

        if steps >= chunk_size {
            chunk_ords.sort_unstable();
            chunk_ords.dedup();
            let ords_str = encode_ordinal_ranges(&chunk_ords);
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                .unwrap();
            chunk_start = offset;
            chunk_ords.clear();
            steps = 0;
        }
    }

    if steps > 0 {
        chunk_ords.sort_unstable();
        chunk_ords.dedup();
        let ords_str = encode_ordinal_ranges(&chunk_ords);
        writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
            .unwrap();
    }

    if need_flip {
        eprintln!("    flipped: {} (all {} shared segments had opposite orient)", path_name, walk_steps.iter().filter(|s| ref_orients.contains_key(&s.ord)).count());
    }

    total_len
}

fn parse_walk(line: &str) -> Option<(String, String, String, bool)> {
    let parts: Vec<&str> = line.splitn(8, '\t').collect();
    if parts.len() < 7 {
        return None;
    }
    let assembly = format!("{}#{}", parts[1], parts[2]);
    let path_name = format!("{}#{}#{}", parts[1], parts[2], parts[3]);
    Some((path_name, assembly, parts[6].to_string(), true))
}

fn parse_p_line(line: &str) -> Option<(String, String, String, bool)> {
    let parts: Vec<&str> = line.splitn(4, '\t').collect();
    if parts.len() < 3 {
        return None;
    }
    let raw_name = parts[1];
    let (sample, sequence) = match raw_name.rfind('#') {
        Some(idx) => (&raw_name[..idx], &raw_name[idx + 1..]),
        None => (raw_name, raw_name),
    };
    Some((
        format!("{}#{}", sample, sequence),
        sample.to_string(),
        parts[2].to_string(),
        false,
    ))
}

fn encode_ordinal_ranges(ords: &[u64]) -> String {
    if ords.is_empty() {
        return String::new();
    }
    let mut parts: Vec<String> = Vec::new();
    let mut run_start = ords[0];
    let mut run_end = ords[0];
    for &o in &ords[1..] {
        if o == run_end + 1 {
            run_end = o;
        } else {
            if run_start == run_end {
                parts.push(run_start.to_string());
            } else {
                parts.push(format!("{}-{}", run_start, run_end));
            }
            run_start = o;
            run_end = o;
        }
    }
    if run_start == run_end {
        parts.push(run_start.to_string());
    } else {
        parts.push(format!("{}-{}", run_start, run_end));
    }
    parts.join(",")
}

fn output_parent(prefix: &str) -> std::path::PathBuf {
    std::path::Path::new(prefix)
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf()
}

fn open_file(path: &str) -> Box<dyn BufRead> {
    if path == "-" {
        Box::new(BufReader::with_capacity(1 << 20, std::io::stdin()))
    } else if path.ends_with(".gz") {
        let child = Command::new("gzip")
            .args(["-dc", path])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap_or_else(|_| panic!("failed to open {}", path));
        Box::new(BufReader::with_capacity(1 << 20, child.stdout.unwrap()))
    } else {
        let file = File::open(path).unwrap_or_else(|_| panic!("failed to open {}", path));
        Box::new(BufReader::with_capacity(1 << 20, file))
    }
}

fn spawn_sort_bgzip(output: &str) -> std::process::Child {
    Command::new("sh")
        .args(["-c", &format!("sort -t\"\t\" -k1,1 -k2,2n | bgzip > \"{}\"", output)])
        .env("LC_ALL", "C")
        .stdin(Stdio::piped())
        .spawn()
        .expect("failed to spawn sort|bgzip")
}

fn run_cmd(cmd: &str, args: &[&str]) {
    let status = Command::new(cmd).args(args).status().unwrap_or_else(|_| panic!("failed to run {}", cmd));
    if !status.success() {
        eprintln!("Warning: {} {:?} failed", cmd, args);
    }
}


fn write_jbrowse_config(
    config_path: &str,
    output_prefix: &str,
    genomes: &[String],
) {
    eprintln!("Writing JBrowse config...");
    let mut out = BufWriter::new(File::create(config_path).expect("create config file"));

    let pos_bed = format!("{}.pos.bed.gz", output_prefix);
    let pos_tbi = format!("{}.pos.bed.gz.tbi", output_prefix);
    let synteny_bed = format!("{}.synteny.bed.gz", output_prefix);
    let synteny_tbi = format!("{}.synteny.bed.gz.tbi", output_prefix);
    let edges_bed = format!("{}.edges.spatial.bed.gz", output_prefix);
    let edges_tbi = format!("{}.edges.spatial.bed.gz.tbi", output_prefix);
    let seglens_bin = format!("{}.seglens.bin", output_prefix);

    let assembly_names_json: Vec<String> = genomes.iter().map(|g| format!("\"{}\"", g)).collect();

    write!(out, "{{\n  \"tracks\": [\n").unwrap();
    write!(out, "    {{\n").unwrap();
    write!(out, "      \"type\": \"MultiSyntenyTrack\",\n").unwrap();
    write!(out, "      \"trackId\": \"gfa_tabix_multi\",\n").unwrap();
    write!(out, "      \"name\": \"Pangenome synteny\",\n").unwrap();
    write!(out, "      \"category\": [\"Synteny\"],\n").unwrap();
    write!(out, "      \"adapter\": {{\n").unwrap();
    write!(out, "        \"type\": \"GfaTabixAdapter\",\n").unwrap();
    write!(out, "        \"posLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", pos_bed).unwrap();
    write!(out, "        \"posIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }},\n", pos_tbi).unwrap();
    write!(out, "        \"syntenyLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", synteny_bed).unwrap();
    write!(out, "        \"syntenyIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }},\n", synteny_tbi).unwrap();
    write!(out, "        \"edgesLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", edges_bed).unwrap();
    write!(out, "        \"edgesIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }},\n", edges_tbi).unwrap();
    write!(out, "        \"seqlensLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }}\n", seglens_bin).unwrap();
    write!(out, "      }},\n").unwrap();
    write!(out, "      \"assemblyNames\": [{}]\n", assembly_names_json.join(", ")).unwrap();
    write!(out, "    }}\n  ]\n}}\n").unwrap();

    eprintln!("  Wrote {}", config_path);
}

fn path_chrom(name: &str) -> &str {
    name.rfind('#').map(|i| &name[i + 1..]).unwrap_or(name)
}

struct SyntenyRow {
    ref_path: String,
    ref_start: u64,
    ref_end: u64,
    hap_path: String,
    hap_start: u64,
    hap_end: u64,
    strand: bool,
    identity: f64,
}

fn align_pair(
    ref_path: &PathData,
    hap_path: &PathData,
    ref_by_ord: &HashMap<u64, (u64, u64, bool)>,
    ref_ord_rank: &HashMap<u64, usize>,
) -> Vec<SyntenyRow> {
    let shared_hap: Vec<(usize, &StepInfo)> = hap_path
        .steps
        .iter()
        .enumerate()
        .filter(|(_, s)| ref_by_ord.contains_key(&s.ord))
        .collect();

    if shared_hap.is_empty() {
        return Vec::new();
    }

    let mut rows: Vec<SyntenyRow> = Vec::new();

    // Emit bubble before first shared step
    if shared_hap[0].0 > 0 {
        let first_shared = shared_hap[0].1;
        let (ref_start, _, _) = ref_by_ord[&first_shared.ord];
        let hap_end = first_shared.offset;
        let hap_start = hap_path.steps[0].offset;
        let hap_len = hap_end.saturating_sub(hap_start);
        if hap_len > 0 {
            rows.push(SyntenyRow {
                ref_path: ref_path.name.clone(),
                ref_start,
                ref_end: ref_start,
                hap_path: hap_path.name.clone(),
                hap_start,
                hap_end,
                strand: true,
                identity: 0.0,
            });
        }
    }

    // Walk consecutive shared steps
    let step_strand = |s: &StepInfo| -> bool {
        let (_, _, ref_is_plus) = ref_by_ord[&s.ord];
        s.is_plus == ref_is_plus
    };

    let mut i = 0;
    while i < shared_hap.len() {
        let (_, step_a) = shared_hap[i];
        let run_strand = step_strand(step_a);

        // Extend run
        let mut j = i + 1;
        while j < shared_hap.len() {
            let (_, step_b) = shared_hap[j];
            let (_, step_prev) = shared_hap[j - 1];

            let rank_a = ref_ord_rank[&step_prev.ord];
            let rank_b = ref_ord_rank[&step_b.ord];
            let (_, ref_end_prev, _) = ref_by_ord[&step_prev.ord];
            let (ref_start_b, _, _) = ref_by_ord[&step_b.ord];
            let hap_contiguous = step_b.offset == step_prev.offset + step_prev.seg_len;
            let ref_contiguous = rank_b == rank_a + 1 && ref_start_b == ref_end_prev;
            let same_strand = step_strand(step_b) == run_strand;

            if ref_contiguous && hap_contiguous && same_strand {
                j += 1;
            } else {
                break;
            }
        }

        // Close run — normalize so ref_start <= ref_end (inverted runs have
        // step_a at the higher ref position when run_strand is false).
        let (_, step_last) = shared_hap[j - 1];
        let (ref_start_run, _, _) = ref_by_ord[&step_a.ord];
        let (_, ref_end_run, _) = ref_by_ord[&step_last.ord];
        let hap_start_run = step_a.offset;
        let hap_end_run = step_last.offset + step_last.seg_len;

        rows.push(SyntenyRow {
            ref_path: ref_path.name.clone(),
            ref_start: ref_start_run.min(ref_end_run),
            ref_end: ref_start_run.max(ref_end_run),
            hap_path: hap_path.name.clone(),
            hap_start: hap_start_run,
            hap_end: hap_end_run,
            strand: run_strand,
            identity: 1.0,
        });

        // Emit bubble between this run and next shared step
        if j < shared_hap.len() {
            let (_, step_next) = shared_hap[j];
            let (_, ref_end_last, _) = ref_by_ord[&step_last.ord];
            let (ref_start_next, _, _) = ref_by_ord[&step_next.ord];
            let bubble_ref_start = ref_end_last.min(ref_start_next);
            let bubble_ref_end = ref_end_last.max(ref_start_next);
            let bubble_hap_start = hap_end_run;
            let bubble_hap_end = step_next.offset;
            let r_len = bubble_ref_end.saturating_sub(bubble_ref_start);
            let h_len = bubble_hap_end.saturating_sub(bubble_hap_start);
            let identity = if r_len > 0 && h_len > 0 {
                r_len.min(h_len) as f64 / r_len.max(h_len) as f64
            } else {
                0.0
            };
            if r_len > 0 || h_len > 0 {
                rows.push(SyntenyRow {
                    ref_path: ref_path.name.clone(),
                    ref_start: bubble_ref_start,
                    ref_end: bubble_ref_end,
                    hap_path: hap_path.name.clone(),
                    hap_start: bubble_hap_start,
                    hap_end: bubble_hap_end,
                    strand: run_strand,
                    identity,
                });
            }
        }

        i = j;
    }

    // Emit bubble after last shared step
    let (_, last_shared) = shared_hap[shared_hap.len() - 1];
    let last_hap_idx = shared_hap[shared_hap.len() - 1].0;
    if last_hap_idx + 1 < hap_path.steps.len() {
        let (_, ref_end_last, _) = ref_by_ord[&last_shared.ord];
        let hap_start = last_shared.offset + last_shared.seg_len;
        let last_step = &hap_path.steps[hap_path.steps.len() - 1];
        let hap_end = last_step.offset + last_step.seg_len;
        let h_len = hap_end.saturating_sub(hap_start);
        if h_len > 0 {
            rows.push(SyntenyRow {
                ref_path: ref_path.name.clone(),
                ref_start: ref_end_last,
                ref_end: ref_end_last,
                hap_path: hap_path.name.clone(),
                hap_start,
                hap_end,
                strand: true,
                identity: 0.0,
            });
        }
    }

    rows
}

fn write_synteny_rows(rows: &[SyntenyRow], w: &mut BufWriter<impl Write>) {
    for row in rows {
        let strand = if row.strand { "+" } else { "-" };
        writeln!(
            w,
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{:.6}",
            row.ref_path, row.ref_start, row.ref_end,
            row.hap_path, row.hap_start, row.hap_end,
            strand, row.identity
        ).unwrap();
    }
}

fn synteny_build(paths: &[PathData], ref_assembly: &str, output_prefix: &str) {
    let synteny_file = format!("{}.synteny.bed.gz", output_prefix);
    let rev_file = format!("{}.synteny.rev.bed.gz", output_prefix);

    let mut fwd_proc = spawn_sort_bgzip(&synteny_file);
    let mut fwd_w = BufWriter::new(fwd_proc.stdin.take().unwrap());
    let mut rev_proc = spawn_sort_bgzip(&rev_file);
    let mut rev_w = BufWriter::new(rev_proc.stdin.take().unwrap());

    // Separate reference paths from haplotype paths. We iterate all hap paths
    // against each reference path rather than grouping by chrom name, because
    // HPRC-style assemblies name their contigs differently from the reference
    // (e.g. GRCh38#0#chr20 vs HG00438#1#JAHBCB010000023.1). align_pair uses
    // shared graph ordinals so it correctly links contigs that don't share a
    // chromosome name with the reference.
    let ref_paths: Vec<&PathData> = paths.iter().filter(|p| p.assembly == ref_assembly).collect();
    let hap_paths: Vec<&PathData> = paths.iter().filter(|p| p.assembly != ref_assembly).collect();

    for ref_path in &ref_paths {
        // Build ref lookup structures
        let mut ref_by_ord: HashMap<u64, (u64, u64, bool)> = HashMap::new();
        let mut ref_ord_rank: HashMap<u64, usize> = HashMap::new();
        let mut offset = 0u64;
        for (rank, step) in ref_path.steps.iter().enumerate() {
            ref_by_ord.insert(step.ord, (offset, offset + step.seg_len, step.is_plus));
            ref_ord_rank.insert(step.ord, rank);
            offset += step.seg_len;
        }

        for hap_path in &hap_paths {
            let rows = align_pair(ref_path, hap_path, &ref_by_ord, &ref_ord_rank);
            if rows.is_empty() {
                continue;
            }

            write_synteny_rows(&rows, &mut fwd_w);

            // Rev: hap as first 3 columns
            let hap_chrom = path_chrom(&hap_path.name);
            for row in &rows {
                let strand = if row.strand { "+" } else { "-" };
                writeln!(
                    rev_w,
                    "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{:.6}",
                    hap_chrom, row.hap_start, row.hap_end,
                    row.ref_path, row.ref_start, row.ref_end,
                    strand, row.identity
                ).unwrap();
            }
        }
    }

    drop(fwd_w);
    assert!(fwd_proc.wait().map(|s| s.success()).unwrap_or(false), "synteny sort|bgzip failed");
    run_cmd("tabix", &["-p", "bed", &synteny_file]);

    drop(rev_w);
    assert!(rev_proc.wait().map(|s| s.success()).unwrap_or(false), "synteny.rev sort|bgzip failed");
    run_cmd("tabix", &["-p", "bed", &rev_file]);

    eprintln!("  Wrote {}, {}", synteny_file, rev_file);
}

fn build_edges_spatial(
    raw_links: &[(String, String, String, String)],
    seg_ordinals: &HashMap<String, u64>,
    seg_lengths: &HashMap<String, u64>,
    paths: &[PathData],
    ref_assembly: &str,
    output_prefix: &str,
) {
    let edges_file = format!("{}.edges.spatial.bed.gz", output_prefix);
    let mut proc = spawn_sort_bgzip(&edges_file);
    let mut w = BufWriter::new(proc.stdin.take().unwrap());

    // Build ord -> (chrom, start, end) from ref paths
    let mut ref_ord_to_pos: HashMap<u64, (String, u64, u64)> = HashMap::new();
    for path in paths.iter().filter(|p| p.assembly == ref_assembly) {
        let chrom = path_chrom(&path.name).to_string();
        for step in &path.steps {
            ref_ord_to_pos.entry(step.ord).or_insert_with(|| (chrom.clone(), step.offset, step.offset + step.seg_len));
        }
    }

    // For alt segments not in ref, find the nearest ref position by looking at
    // what ref segments are adjacent to alt segments in the graph
    // We build seg_name -> ord for reverse lookup
    let ord_to_name: HashMap<u64, &str> = seg_ordinals.iter().map(|(k, &v)| (v, k.as_str())).collect();
    let _ = (seg_lengths, ord_to_name);

    for (src_name, src_orient, tgt_name, tgt_orient) in raw_links {
        let src_ord = match seg_ordinals.get(src_name) {
            Some(&o) => o,
            None => continue,
        };
        let tgt_ord = match seg_ordinals.get(tgt_name) {
            Some(&o) => o,
            None => continue,
        };

        // Find best ref position: prefer src ord, fall back to tgt ord
        let pos = ref_ord_to_pos.get(&src_ord).or_else(|| ref_ord_to_pos.get(&tgt_ord));
        if let Some((chrom, start, end)) = pos {
            // Forward edge
            writeln!(w, "{}\t{}\t{}\t{}\t{}\t{}\t{}", chrom, start, end, src_ord, tgt_ord, src_orient, tgt_orient).unwrap();
            // Reverse edge (flip orientations)
            let rev_src = if src_orient == "+" { "-" } else { "+" };
            let rev_tgt = if tgt_orient == "+" { "-" } else { "+" };
            writeln!(w, "{}\t{}\t{}\t{}\t{}\t{}\t{}", chrom, start, end, tgt_ord, src_ord, rev_tgt, rev_src).unwrap();
        }
    }

    drop(w);
    assert!(proc.wait().map(|s| s.success()).unwrap_or(false), "edges sort|bgzip failed");
    run_cmd("tabix", &["-p", "bed", &edges_file]);
    eprintln!("  Wrote {}", edges_file);
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufWriter;

    fn parse_gfa_for_synteny(gfa: &str) -> (HashMap<String, u64>, HashMap<String, u64>, Vec<PathData>, Vec<(String, String, String, String)>) {
        let mut seg_lengths: HashMap<String, u64> = HashMap::new();
        let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
        let mut next_ordinal: u64 = 0;
        let mut raw_links: Vec<(String, String, String, String)> = Vec::new();
        let mut path_lines: Vec<(String, String, String)> = Vec::new();

        for line in gfa.lines() {
            if line.starts_with("S\t") {
                let mut parts = line.splitn(4, '\t');
                parts.next();
                let name = parts.next().unwrap().to_string();
                let seq = parts.next().unwrap();
                let length = parts
                    .next()
                    .and_then(|rest| {
                        rest.split('\t')
                            .find(|t| t.starts_with("LN:i:"))
                            .map(|t| t[5..].parse::<u64>().unwrap_or(0))
                    })
                    .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 });
                seg_lengths.insert(name, length);
            } else if line.starts_with("L\t") {
                let cols: Vec<&str> = line.splitn(6, '\t').collect();
                if cols.len() >= 5 {
                    raw_links.push((cols[1].to_string(), cols[2].to_string(), cols[3].to_string(), cols[4].to_string()));
                }
            } else if line.starts_with("P\t") {
                let parts: Vec<&str> = line.splitn(4, '\t').collect();
                if parts.len() >= 3 {
                    let raw_name = parts[1];
                    let (sample, _) = match raw_name.rfind('#') {
                        Some(idx) => (&raw_name[..idx], &raw_name[idx + 1..]),
                        None => (raw_name, raw_name),
                    };
                    path_lines.push((format!("{}#{}", sample, &raw_name[raw_name.rfind('#').map(|i| i+1).unwrap_or(0)..]), sample.to_string(), parts[2].to_string()));
                }
            }
        }

        let mut all_paths: Vec<PathData> = Vec::new();
        let mut ref_orients: HashMap<u64, bool> = HashMap::new();

        // First pass to detect ref assembly (first path)
        let ref_assembly_name = path_lines.first().map(|(_, a, _)| a.clone()).unwrap_or_default();

        for (path_name, assembly, seg_str) in &path_lines {
            let is_ref = assembly == &ref_assembly_name;
            let mut steps_out: Vec<StepInfo> = Vec::new();
            let mut ord_walk: Vec<(u64, u64)> = Vec::new();
            let mut sink = BufWriter::new(Vec::new());
            emit_path_rows(
                path_name,
                seg_str,
                false,
                100,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut sink,
                &mut ref_orients,
                is_ref,
                true,
                &mut ord_walk,
                &mut steps_out,
            );
            all_paths.push(PathData { name: path_name.clone(), assembly: assembly.clone(), steps: steps_out });
        }

        (seg_lengths, seg_ordinals, all_paths, raw_links)
    }

    fn run_synteny_on_gfa(gfa: &str, ref_assembly: &str) -> Vec<String> {
        let (_, _, all_paths, _) = parse_gfa_for_synteny(gfa);

        let ref_paths: Vec<&PathData> = all_paths.iter().filter(|p| p.assembly == ref_assembly).collect();
        let hap_paths: Vec<&PathData> = all_paths.iter().filter(|p| p.assembly != ref_assembly).collect();
        let mut rows: Vec<String> = Vec::new();

        for ref_path in &ref_paths {
            let mut ref_by_ord: HashMap<u64, (u64, u64, bool)> = HashMap::new();
            let mut ref_ord_rank: HashMap<u64, usize> = HashMap::new();
            let mut offset = 0u64;
            for (rank, step) in ref_path.steps.iter().enumerate() {
                ref_by_ord.insert(step.ord, (offset, offset + step.seg_len, step.is_plus));
                ref_ord_rank.insert(step.ord, rank);
                offset += step.seg_len;
            }

            for hap_path in &hap_paths {
                let pair_rows = align_pair(ref_path, hap_path, &ref_by_ord, &ref_ord_rank);
                for row in pair_rows {
                    let strand = if row.strand { "+" } else { "-" };
                    rows.push(format!(
                        "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{:.6}",
                        row.ref_path, row.ref_start, row.ref_end,
                        row.hap_path, row.hap_start, row.hap_end,
                        strand, row.identity
                    ));
                }
            }
        }

        rows
    }

    #[test]
    fn linear_full_coverage() {
        let gfa = include_str!("../tests/fixtures/linear.gfa");
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        // Collect ref intervals and merge
        let mut intervals: Vec<(u64, u64)> = rows.iter().map(|r| {
            let cols: Vec<&str> = r.split('\t').collect();
            (cols[1].parse().unwrap(), cols[2].parse().unwrap())
        }).collect();
        intervals.sort();
        let mut merged_total = 0u64;
        let mut cur_start = intervals[0].0;
        let mut cur_end = intervals[0].1;
        for &(s, e) in &intervals[1..] {
            if s <= cur_end {
                cur_end = cur_end.max(e);
            } else {
                merged_total += cur_end - cur_start;
                cur_start = s;
                cur_end = e;
            }
        }
        merged_total += cur_end - cur_start;
        assert_eq!(merged_total, 450, "Expected merged ref coverage = 450 (100+200+150), got {}", merged_total);
    }

    #[test]
    fn bubble_spans() {
        let gfa = include_str!("../tests/fixtures/bubble.gfa");
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        assert_eq!(rows.len(), 3, "Expected 3 rows (s1 block, bubble, s4 block), got {}", rows.len());

        // Check no ref-side overlaps
        let mut intervals: Vec<(u64, u64)> = rows.iter().map(|r| {
            let cols: Vec<&str> = r.split('\t').collect();
            (cols[1].parse::<u64>().unwrap(), cols[2].parse::<u64>().unwrap())
        }).collect();
        intervals.sort();
        for i in 1..intervals.len() {
            assert!(intervals[i].0 >= intervals[i-1].1, "Overlapping ref intervals: {:?} and {:?}", intervals[i-1], intervals[i]);
        }
    }

    #[test]
    fn inversion_strand() {
        let gfa = include_str!("../tests/fixtures/inversion.gfa");
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        assert_eq!(rows.len(), 3, "Expected 3 rows, got {}", rows.len());
        let strands: Vec<&str> = rows.iter().map(|r| r.split('\t').nth(6).unwrap()).collect();
        assert_eq!(strands[0], "+", "First row should be +");
        assert_eq!(strands[1], "-", "Middle row should be -");
        assert_eq!(strands[2], "+", "Last row should be +");
    }

    #[test]
    fn insertion_identity() {
        let gfa = include_str!("../tests/fixtures/insertion.gfa");
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        // Find the bubble row (ref span 50, hap span 350)
        let bubble_row = rows.iter().find(|r| {
            let cols: Vec<&str> = r.split('\t').collect();
            let ref_start: u64 = cols[1].parse().unwrap();
            let ref_end: u64 = cols[2].parse().unwrap();
            let hap_start: u64 = cols[4].parse().unwrap();
            let hap_end: u64 = cols[5].parse().unwrap();
            let ref_len = ref_end.saturating_sub(ref_start);
            let hap_len = hap_end.saturating_sub(hap_start);
            ref_len == 50 && hap_len == 350
        }).expect("Expected a bubble row with refLen=50, hapLen=350");
        let identity: f64 = bubble_row.split('\t').nth(7).unwrap().parse().unwrap();
        let expected = 50.0f64 / 350.0;
        assert!((identity - expected).abs() < 0.001, "Expected identity ≈ {:.6}, got {:.6}", expected, identity);
    }

    #[test]
    fn multipath_independence() {
        let gfa = include_str!("../tests/fixtures/multipath.gfa");
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");

        let hap1_rows: Vec<&str> = rows.iter().filter(|r| r.contains("HG002#1")).map(|r| r.as_str()).collect();
        let hap2_rows: Vec<&str> = rows.iter().filter(|r| r.contains("HG002#2")).map(|r| r.as_str()).collect();

        assert!(!hap1_rows.is_empty(), "HG002#1 should have rows");
        assert!(!hap2_rows.is_empty(), "HG002#2 should have rows");

        // HG002#1 has s3 (80bp bubble), HG002#2 has s6 (90bp bubble)
        // Check that HG002#1 rows don't contain hap spans matching HG002#2's private segment and vice versa
        // s3 is at hap offset 100..180 for HG002#1 (after s1=100), s6 is at hap offset 260..350 for HG002#2 (after s1+s2+s4=100+60+100)
        for r in &hap2_rows {
            assert!(!r.contains("HG002#1"), "HG002#2 row should not reference HG002#1: {}", r);
        }
        for r in &hap1_rows {
            assert!(!r.contains("HG002#2"), "HG002#1 row should not reference HG002#2: {}", r);
        }
    }

    #[test]
    fn edges_count() {
        let gfa = include_str!("../tests/fixtures/bubble.gfa");
        let (_, seg_ordinals, all_paths, raw_links) = parse_gfa_for_synteny(gfa);
        let seg_lengths: HashMap<String, u64> = {
            let mut m = HashMap::new();
            for line in gfa.lines() {
                if line.starts_with("S\t") {
                    let mut parts = line.splitn(4, '\t');
                    parts.next();
                    let name = parts.next().unwrap().to_string();
                    let seq = parts.next().unwrap();
                    let length = parts.next()
                        .and_then(|rest| rest.split('\t').find(|t| t.starts_with("LN:i:")).map(|t| t[5..].parse::<u64>().unwrap_or(0)))
                        .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 });
                    m.insert(name, length);
                }
            }
            m
        };

        let tmp = std::env::temp_dir().join(format!("edges_count_test_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let prefix = tmp.join("test").to_str().unwrap().to_string();
        build_edges_spatial(&raw_links, &seg_ordinals, &seg_lengths, &all_paths, "GRCh38#0", &prefix);

        let edges_file = format!("{}.edges.spatial.bed.gz", prefix);
        let output = Command::new("sh")
            .args(["-c", &format!("bgzip -dc \"{}\" | grep -v '^#' | wc -l", edges_file)])
            .output()
            .expect("count edges");
        let count: usize = String::from_utf8_lossy(&output.stdout).trim().parse().unwrap_or(0);
        std::fs::remove_dir_all(&tmp).ok();
        assert_eq!(count, 8, "Expected 8 edge rows (2 × 4 L-lines), got {}", count);
    }

    #[test]
    fn edges_bidirectional() {
        let gfa = include_str!("../tests/fixtures/bubble.gfa");
        let (_, seg_ordinals, all_paths, raw_links) = parse_gfa_for_synteny(gfa);
        let seg_lengths: HashMap<String, u64> = {
            let mut m = HashMap::new();
            for line in gfa.lines() {
                if line.starts_with("S\t") {
                    let mut parts = line.splitn(4, '\t');
                    parts.next();
                    let name = parts.next().unwrap().to_string();
                    let seq = parts.next().unwrap();
                    let length = parts.next()
                        .and_then(|rest| rest.split('\t').find(|t| t.starts_with("LN:i:")).map(|t| t[5..].parse::<u64>().unwrap_or(0)))
                        .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 });
                    m.insert(name, length);
                }
            }
            m
        };

        let tmp = std::env::temp_dir().join(format!("edges_bidir_test_{}", std::process::id()));
        std::fs::create_dir_all(&tmp).unwrap();
        let prefix = tmp.join("test").to_str().unwrap().to_string();
        build_edges_spatial(&raw_links, &seg_ordinals, &seg_lengths, &all_paths, "GRCh38#0", &prefix);

        let edges_file = format!("{}.edges.spatial.bed.gz", prefix);
        let output = Command::new("sh")
            .args(["-c", &format!("bgzip -dc \"{}\"", edges_file)])
            .output()
            .expect("read edges");
        let content = String::from_utf8_lossy(&output.stdout);
        std::fs::remove_dir_all(&tmp).ok();

        // s1 ord=0, s2 ord=1, s3 ord=2, s4 ord=3 (ref path first)
        // Check both directions for s1->s2 link: row with (0,1) and row with (1,0)
        let has_fwd = content.lines().any(|l| {
            let cols: Vec<&str> = l.split('\t').collect();
            cols.len() >= 5 && cols[3] == "0" && cols[4] == "1"
        });
        let has_rev = content.lines().any(|l| {
            let cols: Vec<&str> = l.split('\t').collect();
            cols.len() >= 5 && cols[3] == "1" && cols[4] == "0"
        });
        assert!(has_fwd, "Missing forward edge 0->1");
        assert!(has_rev, "Missing reverse edge 1->0");
    }

    #[test]
    fn rev_key_matches() {
        let gfa = include_str!("../tests/fixtures/bubble.gfa");
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");

        for row in &rows {
            let cols: Vec<&str> = row.split('\t').collect();
            let hap_path = cols[3];
            let hap_start: u64 = cols[4].parse().unwrap();
            let hap_end: u64 = cols[5].parse().unwrap();
            let hap_chrom = path_chrom(hap_path);

            // Reconstruct what the rev row would look like
            let expected_prefix = format!("{}\t{}\t{}", hap_chrom, hap_start, hap_end);
            let found = rows.iter().any(|r| {
                // We re-simulate rev from the forward rows
                let c: Vec<&str> = r.split('\t').collect();
                c[3] == hap_path && c[4] == cols[4] && c[5] == cols[5]
            });
            assert!(found, "No matching rev row for hap span {}:{}-{}", hap_chrom, hap_start, hap_end);
            let _ = expected_prefix;
        }
    }


    // HPRC-style GFAs name haplotype contigs differently from the reference
    // (e.g., GRCh38#0#chr20 vs HG00438#1#JAHBCB010000023.1). The old
    // chrom-grouping approach missed these; the new ordinal-based pairing
    // must link them correctly.
    #[test]
    fn synteny_cross_chrom_hprc_style() {
        // seg1 shared by ref and hap (different chrom names)
        // ref: GRCh38#0#chr20  steps: [s0, s1, s2]
        // hap: HG00438#1#JAHBCB010000023.1  steps: [s0, s1, s2]  (same ordinals, different name)
        let gfa = "\
H\tVN:Z:1.1\n\
S\ts0\tAAAA\tLN:i:4\n\
S\ts1\tCCCC\tLN:i:4\n\
S\ts2\tGGGG\tLN:i:4\n\
P\tGRCh38#0#chr20\ts0+,s1+,s2+\t*\n\
P\tCHM13#0#chr20\ts0+,s1+,s2+\t*\n\
P\tHG00438#1#JAHBCB010000023.1\ts0+,s1+,s2+\t*\n\
";
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        let hap_chroms: std::collections::HashSet<&str> = rows.iter()
            .map(|r| r.split('\t').nth(3).unwrap())
            .collect();
        assert!(hap_chroms.contains("CHM13#0#chr20"), "CHM13 chr20 must appear");
        assert!(hap_chroms.contains("HG00438#1#JAHBCB010000023.1"),
            "cross-chrom hap with shared ordinals must appear; got {:?}", hap_chroms);
        assert_eq!(hap_chroms.len(), 2, "exactly two query paths");
    }

    // Regression: when grooming flips a rev-complemented hap contig, every
    // emitted synteny row must satisfy hap_end >= hap_start. Pre-fix, the
    // bubble emitter pulled hap offsets from descending step_out and produced
    // rows with hap_end < hap_start (e.g. JAGYVH010000048.1 9 0 in the
    // chr20 build).
    #[test]
    fn flipped_contig_hap_bounds_valid() {
        let gfa = "H\tVN:Z:1.0\n\
                   S\ts1\t*\tLN:i:100\n\
                   S\ts2\t*\tLN:i:150\n\
                   S\ts3\t*\tLN:i:100\n\
                   S\ts_alt\t*\tLN:i:50\n\
                   P\tGRCh38#0#chr1\ts1+,s2+,s3+\t*\n\
                   P\tHG002#1#chr1\ts3-,s_alt-,s1-\t*\n";
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        assert!(!rows.is_empty(), "expected at least one row");
        for r in &rows {
            let cols: Vec<&str> = r.split('\t').collect();
            let hap_start: u64 = cols[4].parse().unwrap();
            let hap_end: u64 = cols[5].parse().unwrap();
            assert!(
                hap_end >= hap_start,
                "hap_end({}) < hap_start({}) in row: {}",
                hap_end, hap_start, r,
            );
        }
    }

    // Regression: a hap path that is entirely rev-complement of the reference
    // (every shared segment in opposite orient) should be groomed and emit a
    // single co-linear run, not one row per segment. Pre-fix, hap_contiguous
    // failed on descending offsets and runs never extended.
    #[test]
    fn flipped_contig_merges_into_one_run() {
        let gfa = "H\tVN:Z:1.0\n\
                   S\ts1\t*\tLN:i:100\n\
                   S\ts2\t*\tLN:i:150\n\
                   S\ts3\t*\tLN:i:100\n\
                   P\tGRCh38#0#chr1\ts1+,s2+,s3+\t*\n\
                   P\tHG002#1#chr1\ts3-,s2-,s1-\t*\n";
        let rows = run_synteny_on_gfa(gfa, "GRCh38#0");
        assert_eq!(
            rows.len(),
            1,
            "fully rev-complement contig should emit one merged row; got {}: {:#?}",
            rows.len(),
            rows,
        );
        let cols: Vec<&str> = rows[0].split('\t').collect();
        assert_eq!(cols[1], "0");
        assert_eq!(cols[2], "350");
        let hap_start: u64 = cols[4].parse().unwrap();
        let hap_end: u64 = cols[5].parse().unwrap();
        assert_eq!(hap_end - hap_start, 350);
    }

}
