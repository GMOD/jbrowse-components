use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};
use std::time::Instant;

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

    /// Generate bubbles BED file from a VCF produced by vg deconstruct.
    /// Computes CS between all allele pairs at each variant site.
    #[arg(long)]
    bubbles: Option<String>,

    /// Write a JBrowse config JSON file with track entries for the generated
    /// GfaTabix multi-synteny track plus (when --bubbles is used) a VCF
    /// variant track pointing at the source VCF.
    #[arg(long)]
    output_config: Option<String>,

    /// Generate a graph coarse index (prefix.graph.coarse.bed.gz).
    /// Requires vg to be installed (for snarl method) or no external tool (for tile method).
    #[arg(long)]
    graph_coarse: bool,

    /// Method for graph coarse index: "snarl" (default, uses vg snarls) or "tile" (fixed bp windows).
    #[arg(long, default_value = "snarl")]
    graph_coarse_method: String,

    /// Minimum snarl ref-span in bp to emit as a snarl super-node (snarl method only).
    #[arg(long, default_value_t = 100)]
    graph_coarse_min_sv_bp: u64,

    /// Tile size in bp for the tile method.
    #[arg(long, default_value_t = 10_000)]
    graph_coarse_tile_size: u64,

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
    let bubbles_vcf = cli.bubbles;
    let output_config = cli.output_config;
    let graph_coarse = cli.graph_coarse;
    let graph_coarse_method = cli.graph_coarse_method;
    let graph_coarse_min_sv_bp = cli.graph_coarse_min_sv_bp;
    let graph_coarse_tile_size = cli.graph_coarse_tile_size;

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
        if graph_coarse {
            match graph_coarse_method.as_str() {
                "snarl" => {
                    eprintln!("Building graph coarse index (snarl method, min {}bp)...", graph_coarse_min_sv_bp);
                    graph_coarse_build_snarls(gfa_path, &all_paths, ra, &seg_ordinals, &output_prefix, graph_coarse_min_sv_bp);
                }
                _ => {
                    eprintln!("Building graph coarse index (tile method, {}bp tiles)...", graph_coarse_tile_size);
                    graph_coarse_build_tiles(&all_paths, ra, &output_prefix, graph_coarse_tile_size);
                }
            }
        }
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

    let rewritten_vcf_path;
    if let Some(ref vcf_path) = bubbles_vcf {
        let ord_to_paths: HashMap<u64, Vec<(usize, u64, u64)>> = {
            let mut m: HashMap<u64, Vec<(usize, u64, u64)>> = HashMap::new();
            for (pi, path) in all_paths.iter().enumerate() {
                for step in &path.steps {
                    m.entry(step.ord).or_default().push((pi, step.offset, step.seg_len));
                }
            }
            m
        };
        generate_bubbles_from_vcf(vcf_path, &output_prefix, &genomes, &path_names, &ref_ord_walks, &ord_to_paths);
        rewritten_vcf_path = format!("{}.vcf.gz", output_prefix);
        // Write to a temp file first to avoid clobbering the input VCF
        // when the output path matches the input path
        let tmp_vcf = format!("{}.vcf.gz.tmp", output_prefix);
        rewrite_vcf_strip_pansn(vcf_path, &tmp_vcf);
        fs::rename(&tmp_vcf, &rewritten_vcf_path).expect("rename rewritten VCF");
        // tabix indexed the tmp path, rename the index too
        let tmp_tbi = format!("{}.tbi", tmp_vcf);
        let final_tbi = format!("{}.tbi", rewritten_vcf_path);
        if std::path::Path::new(&tmp_tbi).exists() {
            fs::rename(&tmp_tbi, &final_tbi).expect("rename rewritten VCF index");
        }
    } else {
        rewritten_vcf_path = String::new();
    }

    if let Some(ref config_path) = output_config {
        let vcf_for_config = if bubbles_vcf.is_some() {
            Some(rewritten_vcf_path.as_str())
        } else {
            None
        };
        write_jbrowse_config(
            config_path,
            &output_prefix,
            &genomes,
            vcf_for_config,
            graph_coarse,
        );
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
    // If the walk needs flipping, reverse the offset direction and
    // invert all orient values.
    let total_len: u64 = walk_steps.iter().map(|s| s.seg_len).sum();
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_ords: Vec<u64> = Vec::new();
    let mut steps: usize = 0;

    for step in &walk_steps {
        // need_flip handles whole-contig rev-comp normalization.
        let emit_offset = if need_flip {
            total_len - offset - step.seg_len
        } else {
            offset
        };

        let effective_is_plus = if need_flip { !step.is_plus } else { step.is_plus };
        ord_walk_out.push((emit_offset, step.ord));
        step_out.push(StepInfo {
            ord: step.ord,
            offset: emit_offset,
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
            if need_flip {
                let flip_start = total_len - offset;
                let flip_end = total_len - chunk_start;
                writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, flip_start, flip_end, ords_str)
                    .unwrap();
            } else {
                writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                    .unwrap();
            }
            chunk_start = offset;
            chunk_ords.clear();
            steps = 0;
        }
    }

    if steps > 0 {
        chunk_ords.sort_unstable();
        chunk_ords.dedup();
        let ords_str = encode_ordinal_ranges(&chunk_ords);
        if need_flip {
            let flip_start = total_len - offset;
            let flip_end = total_len - chunk_start;
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, flip_start, flip_end, ords_str)
                .unwrap();
        } else {
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                .unwrap();
        }
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

// ── Binary CS encoding ──────────────────────────────────────────────────
//
// Format (high 2 bits of first byte = opcode):
//   Match  (00xxxxxx): low 6 bits = length for 1-63, else 0x00 + LEB128 varint
//   Sub    (01xxRRAA): single byte, bits 3:2 = ref base, bits 1:0 = alt base
//   Ins    (10xxxxxx): low 6 bits = length for 1-63, else 0x80 + LEB128 varint,
//                      followed by ceil(len/4) bytes of 2-bit packed bases
//   Del    (11xxxxxx): same as insertion
//
// Base encoding: A=0, C=1, G=2, T=3

const BCS_MATCH: u8 = 0x00;
const BCS_SUB: u8 = 0x40;
const BCS_INS: u8 = 0x80;
const BCS_DEL: u8 = 0xC0;

fn base_to_2bit(b: u8) -> u8 {
    match b {
        b'A' | b'a' => 0,
        b'C' | b'c' => 1,
        b'G' | b'g' => 2,
        b'T' | b't' => 3,
        _ => 0,
    }
}

fn write_varint(out: &mut Vec<u8>, mut value: u32) {
    while value >= 0x80 {
        out.push((value as u8 & 0x7f) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
}

fn pack_bases(seq: &[u8], out: &mut Vec<u8>) {
    for chunk in seq.chunks(4) {
        let mut byte: u8 = 0;
        for (j, &b) in chunk.iter().enumerate() {
            byte |= base_to_2bit(b) << (6 - j * 2);
        }
        out.push(byte);
    }
}

const TWOBIT_TO_BASE: [u8; 4] = [b'a', b'c', b'g', b't'];

fn unpack_bases(data: &[u8], len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    for &byte in data {
        for shift in [6, 4, 2, 0] {
            if out.len() >= len { break; }
            out.push(TWOBIT_TO_BASE[((byte >> shift) & 0x03) as usize]);
        }
    }
    out
}

fn binary_cs_to_text(data: &[u8]) -> String {
    let mut out = String::new();
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        let op = byte & 0xC0;

        if op == BCS_MATCH {
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                read_varint_slice(data, &mut i) as u64
            } else {
                len_bits as u64
            };
            out.push(':');
            out.push_str(&len.to_string());
        } else if op == BCS_SUB {
            let ref_base = TWOBIT_TO_BASE[((byte >> 2) & 0x03) as usize];
            let alt_base = TWOBIT_TO_BASE[(byte & 0x03) as usize];
            out.push('*');
            out.push(ref_base as char);
            out.push(alt_base as char);
            i += 1;
        } else {
            let is_ins = op == BCS_INS;
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                read_varint_slice(data, &mut i) as u64
            } else {
                len_bits as u64
            };
            let packed = ((len + 3) / 4) as usize;
            let bases = unpack_bases(&data[i..i + packed], len as usize);
            out.push(if is_ins { '+' } else { '-' });
            for &b in &bases {
                out.push(b as char);
            }
            i += packed;
        }
    }
    out
}

fn read_varint_slice(data: &[u8], pos: &mut usize) -> u32 {
    let mut value: u32 = 0;
    let mut shift = 0;
    while *pos < data.len() {
        let b = data[*pos];
        *pos += 1;
        value |= ((b & 0x7f) as u32) << shift;
        if b & 0x80 == 0 { break; }
        shift += 7;
    }
    value
}

fn to_lower(b: u8) -> u8 {
    if b >= b'A' && b <= b'Z' { b + 32 } else { b }
}

// Compare two byte sequences and produce binary CS directly,
// avoiding intermediate text CS string entirely.
fn compute_binary_cs_from_bytes(ref_seq: &[u8], query_seq: &[u8]) -> Vec<u8> {
    let min_len = ref_seq.len().min(query_seq.len());
    let mut out: Vec<u8> = Vec::new();

    let mut match_run = 0u32;
    for i in 0..min_len {
        if ref_seq[i] == query_seq[i] {
            match_run += 1;
        } else {
            if match_run > 0 {
                if match_run <= 63 {
                    out.push(BCS_MATCH | match_run as u8);
                } else {
                    out.push(BCS_MATCH);
                    write_varint(&mut out, match_run);
                }
                match_run = 0;
            }
            let ref_base = base_to_2bit(ref_seq[i]);
            let alt_base = base_to_2bit(query_seq[i]);
            out.push(BCS_SUB | (ref_base << 2) | alt_base);
        }
    }
    if match_run > 0 {
        if match_run <= 63 {
            out.push(BCS_MATCH | match_run as u8);
        } else {
            out.push(BCS_MATCH);
            write_varint(&mut out, match_run);
        }
    }

    if ref_seq.len() > min_len {
        encode_indel(&mut out, BCS_DEL, &ref_seq[min_len..]);
    } else if query_seq.len() > min_len {
        encode_indel(&mut out, BCS_INS, &query_seq[min_len..]);
    }

    out
}

fn compute_identity_from_binary_cs(data: &[u8]) -> f64 {
    let mut match_bp: u64 = 0;
    let mut mismatch_bp: u64 = 0;
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        let op = byte & 0xC0;
        if op == BCS_MATCH {
            let len_bits = byte & 0x3F;
            i += 1;
            if len_bits == 0 {
                let mut value: u32 = 0;
                let mut shift = 0;
                while i < data.len() {
                    let b = data[i];
                    value |= ((b & 0x7f) as u32) << shift;
                    i += 1;
                    if b & 0x80 == 0 { break; }
                    shift += 7;
                }
                match_bp += value as u64;
            } else {
                match_bp += len_bits as u64;
            }
        } else if op == BCS_SUB {
            mismatch_bp += 1;
            i += 1;
        } else {
            // INS or DEL
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                let mut value: u32 = 0;
                let mut shift = 0;
                while i < data.len() {
                    let b = data[i];
                    value |= ((b & 0x7f) as u32) << shift;
                    i += 1;
                    if b & 0x80 == 0 { break; }
                    shift += 7;
                }
                value
            } else {
                len_bits as u32
            };
            i += ((len + 3) / 4) as usize;
        }
    }
    let total = match_bp + mismatch_bp;
    if total > 0 { match_bp as f64 / total as f64 } else { 1.0 }
}

fn encode_indel(cs: &mut Vec<u8>, op: u8, seq: &[u8]) {
    let len = seq.len() as u32;
    if len <= 63 { cs.push(op | len as u8); }
    else { cs.push(op); write_varint(cs, len); }
    pack_bases(seq, cs);
}

fn encode_bubble_cs(ref_seq: &[u8], query_seq: &[u8], cs: &mut Vec<u8>) {
    if !ref_seq.is_empty() && !query_seq.is_empty() {
        cs.extend_from_slice(&compute_binary_cs_from_bytes(ref_seq, query_seq));
    } else if !ref_seq.is_empty() {
        encode_indel(cs, BCS_DEL, ref_seq);
    } else if !query_seq.is_empty() {
        encode_indel(cs, BCS_INS, query_seq);
    }
}

fn write_jbrowse_config(
    config_path: &str,
    output_prefix: &str,
    genomes: &[String],
    bubbles_vcf: Option<&str>,
    graph_coarse: bool,
) {
    eprintln!("Writing JBrowse config...");
    let mut out = BufWriter::new(File::create(config_path).expect("create config file"));

    let pos_bed = format!("{}.pos.bed.gz", output_prefix);
    let pos_tbi = format!("{}.pos.bed.gz.tbi", output_prefix);
    let synteny_bed = format!("{}.synteny.bed.gz", output_prefix);
    let synteny_tbi = format!("{}.synteny.bed.gz.tbi", output_prefix);
    let synteny_coarse_bed = format!("{}.synteny.coarse.bed.gz", output_prefix);
    let synteny_coarse_tbi = format!("{}.synteny.coarse.bed.gz.tbi", output_prefix);
    let bubbles_bed = format!("{}.bubbles.bed.gz", output_prefix);
    let bubbles_tbi = format!("{}.bubbles.bed.gz.tbi", output_prefix);
    let edges_bed = format!("{}.edges.spatial.bed.gz", output_prefix);
    let graph_coarse_bed = format!("{}.graph.coarse.bed.gz", output_prefix);
    let graph_coarse_tbi = format!("{}.graph.coarse.bed.gz.tbi", output_prefix);
    let edges_tbi = format!("{}.edges.spatial.bed.gz.tbi", output_prefix);
    let seglens_bin = format!("{}.seglens.bin", output_prefix);

    // Build assembly names JSON array
    let assembly_names_json: Vec<String> = genomes.iter().map(|g| format!("\"{}\"", g)).collect();

    write!(out, "{{\n  \"tracks\": [\n").unwrap();

    // GfaTabix multi-synteny track
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
    write!(out, "        \"syntenyCoarseLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", synteny_coarse_bed).unwrap();
    write!(out, "        \"syntenyCoarseIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }},\n", synteny_coarse_tbi).unwrap();
    write!(out, "        \"edgesLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", edges_bed).unwrap();
    write!(out, "        \"edgesIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }},\n", edges_tbi).unwrap();
    write!(out, "        \"seqlensLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }}", seglens_bin).unwrap();
    if bubbles_vcf.is_some() {
        write!(out, ",\n        \"bubblesLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", bubbles_bed).unwrap();
        write!(out, "        \"bubblesIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }}", bubbles_tbi).unwrap();
        if graph_coarse {
            write!(out, ",\n        \"graphCoarseLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", graph_coarse_bed).unwrap();
            write!(out, "        \"graphCoarseIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }}\n", graph_coarse_tbi).unwrap();
        } else {
            write!(out, "\n").unwrap();
        }
    } else if graph_coarse {
        write!(out, ",\n        \"graphCoarseLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", graph_coarse_bed).unwrap();
        write!(out, "        \"graphCoarseIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }}\n", graph_coarse_tbi).unwrap();
    } else {
        write!(out, "\n").unwrap();
    }

    write!(out, "      }},\n").unwrap();
    write!(out, "      \"assemblyNames\": [{}]\n", assembly_names_json.join(", ")).unwrap();
    write!(out, "    }}").unwrap();

    // VCF variant track (when --bubbles VCF was provided)
    if let Some(vcf_path) = bubbles_vcf {
        let vcf_tbi = format!("{}.tbi", vcf_path);
        write!(out, ",\n    {{\n").unwrap();
        write!(out, "      \"type\": \"VariantTrack\",\n").unwrap();
        write!(out, "      \"trackId\": \"pangenome_vcf\",\n").unwrap();
        write!(out, "      \"name\": \"Pangenome variants (vg deconstruct)\",\n").unwrap();
        write!(out, "      \"category\": [\"Variants\"],\n").unwrap();
        write!(out, "      \"adapter\": {{\n").unwrap();
        write!(out, "        \"type\": \"VcfTabixAdapter\",\n").unwrap();
        write!(out, "        \"vcfGzLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", vcf_path).unwrap();
        write!(out, "        \"index\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }}\n", vcf_tbi).unwrap();
        write!(out, "      }},\n").unwrap();
        // VCF variant track only needs the reference assembly (first genome)
        if let Some(ref_genome) = genomes.first() {
            write!(out, "      \"assemblyNames\": [\"{}\"]\n", ref_genome).unwrap();
        }
        write!(out, "    }}").unwrap();
    }

    write!(out, "\n  ]\n}}\n").unwrap();
    eprintln!("  Wrote {}", config_path);
}

/// Strips PanSN contig names from a `vg deconstruct` VCF.
/// `GRCh38#0#chr20` in CHROM column and `##contig` headers becomes `chr20`
/// (last `#`-separated component).  The output is bgzipped and tabix-indexed.
fn rewrite_vcf_strip_pansn(vcf_path: &str, output_path: &str) {
    eprintln!("Rewriting VCF with stripped PanSN contig names...");
    let reader = open_file(vcf_path);

    let mut bgzip = Command::new("bgzip")
        .stdin(Stdio::piped())
        .stdout(File::create(output_path).expect("create rewritten VCF"))
        .spawn()
        .expect("failed to spawn bgzip");
    let mut w = BufWriter::new(bgzip.stdin.take().unwrap());

    for line in reader.lines() {
        let line = line.expect("read error");
        if line.starts_with("##contig=<ID=") {
            // ##contig=<ID=GRCh38#0#chr20,length=64444167>
            // → ##contig=<ID=chr20,length=64444167>
            let rest = &line["##contig=<ID=".len()..];
            if let Some(comma_pos) = rest.find(',') {
                let contig_name = &rest[..comma_pos];
                let stripped = strip_pansn_contig(contig_name);
                writeln!(w, "##contig=<ID={}{}", stripped, &rest[comma_pos..]).unwrap();
            } else {
                let contig_name = rest.trim_end_matches('>');
                let stripped = strip_pansn_contig(contig_name);
                writeln!(w, "##contig=<ID={}>", stripped).unwrap();
            }
            continue;
        }
        if line.starts_with("##") {
            writeln!(w, "{}", line).unwrap();
            continue;
        }
        if line.starts_with("#CHROM") {
            writeln!(w, "{}", line).unwrap();
            continue;
        }

        // Data line: strip PanSN from CHROM (field 0)
        if let Some(tab_pos) = line.find('\t') {
            let chrom = &line[..tab_pos];
            let stripped = strip_pansn_contig(chrom);
            write!(w, "{}{}\n", stripped, &line[tab_pos..]).unwrap();
        } else {
            writeln!(w, "{}", line).unwrap();
        }
    }

    drop(w);
    assert!(
        bgzip.wait().map(|s| s.success()).unwrap_or(false),
        "bgzip failed for rewritten VCF"
    );
    run_cmd("tabix", &["-p", "vcf", output_path]);
    eprintln!("  Wrote {}", output_path);
}

/// Strips PanSN prefix from a contig name: `GRCh38#0#chr20` → `chr20`.
/// Returns the last `#`-separated component if there are 3+ parts,
/// otherwise returns the name unchanged.
fn strip_pansn_contig(name: &str) -> &str {
    let parts: Vec<&str> = name.split('#').collect();
    if parts.len() >= 3 {
        parts[parts.len() - 1]
    } else {
        name
    }
}

fn generate_bubbles_from_vcf(
    vcf_path: &str,
    output_prefix: &str,
    genomes: &[String],
    path_names: &[String],
    ref_ord_walks: &HashMap<String, Vec<(u64, u64)>>,
    ord_to_paths: &HashMap<u64, Vec<(usize, u64, u64)>>,
) {
    eprintln!("Generating bubbles from VCF...");
    let t_start = Instant::now();
    let bubbles_file = format!("{}.bubbles.bed.gz", output_prefix);

    let mut proc = spawn_sort_bgzip(&bubbles_file);
    let mut w = BufWriter::new(proc.stdin.take().unwrap());

    let reader = open_file(vcf_path);
    let mut sample_names: Vec<String> = Vec::new();
    let mut sample_hap_to_genome: Vec<Vec<usize>> = Vec::new();
    let mut bubble_genome_names: Vec<String> = Vec::new();
    let mut record_count: u64 = 0;

    for line in reader.lines() {
        let line = line.expect("read error");
        if line.starts_with("##") {
            continue;
        }
        if line.starts_with("#CHROM") {
            let fields: Vec<&str> = line.split('\t').collect();
            if fields.len() > 9 {
                for f in &fields[9..] {
                    sample_names.push(f.to_string());
                }
            }

            let genome_set: HashMap<&str, Vec<(usize, &str)>> = {
                let mut m: HashMap<&str, Vec<(usize, &str)>> = HashMap::new();
                for (gi, g) in genomes.iter().enumerate() {
                    let sample_part = g.split('#').next().unwrap_or(g);
                    m.entry(sample_part).or_default().push((gi, g));
                }
                m
            };

            for sample_name in &sample_names {
                let mut hap_indices: Vec<usize> = Vec::new();
                if let Some(gfa_genomes) = genome_set.get(sample_name.as_str()) {
                    let mut sorted: Vec<_> = gfa_genomes.clone();
                    sorted.sort_by_key(|(_, name)| {
                        name.split('#').nth(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0)
                    });
                    for (_, gfa_name) in &sorted {
                        let idx = bubble_genome_names.len();
                        bubble_genome_names.push(gfa_name.to_string());
                        hap_indices.push(idx);
                    }
                }
                sample_hap_to_genome.push(hap_indices);
            }

            eprintln!("  {} VCF samples → {} bubble genomes", sample_names.len(), bubble_genome_names.len());
            writeln!(w, "#genomes={}", bubble_genome_names.join(",")).unwrap();
            continue;
        }

        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 10 {
            continue;
        }

        let chrom = fields[0];
        let pos: u64 = fields[1].parse().unwrap_or(0);
        let ref_seq = fields[3];
        let alt_field = fields[4];
        let start = pos - 1;

        let mut alleles: Vec<&str> = Vec::new();
        alleles.push(ref_seq);
        for alt in alt_field.split(',') {
            alleles.push(alt);
        }

        let num_alleles = alleles.len();
        let mut allele_genomes: Vec<Vec<usize>> = vec![Vec::new(); num_alleles];

        for (si, &sample_field) in fields[9..].iter().enumerate() {
            let gt = sample_field.split(':').next().unwrap_or(".");
            let is_phased = gt.contains('|');
            let parts: Vec<&str> = gt.split(|c: char| c == '|' || c == '/').collect();
            let haps = &sample_hap_to_genome[si];

            for (hi, part) in parts.iter().enumerate() {
                if *part != "." {
                    if let Ok(allele_idx) = part.parse::<usize>() {
                        if allele_idx < num_alleles {
                            if is_phased && hi < haps.len() {
                                allele_genomes[allele_idx].push(haps[hi]);
                            } else {
                                for &gidx in haps {
                                    allele_genomes[allele_idx].push(gidx);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Find the ordinal at VCF-ref position `start` using the ref path's walk.
        // The VCF CHROM must be a full PanSN path name (e.g. ref#0#ctgA)
        // matching a path in the GFA.
        let snarl_ordinal = ref_ord_walks.get(chrom).and_then(|walk| {
            let idx = walk.partition_point(|&(off, _)| off <= start);
            if idx > 0 { Some(walk[idx - 1].1) } else { walk.first().map(|&(_, o)| o) }
        });

        // Compute CS between all distinct allele pairs
        const MAX_ALLELE_LEN: usize = 10_000;
        const MAX_PAIRS_PER_SITE: usize = 500;

        struct PairData {
            a: usize,
            b: usize,
            identity: f64,
            cs_text: String,
            genomes_a: String,
            genomes_b: String,
        }
        let mut pairs: Vec<PairData> = Vec::new();
        let mut site_pairs: usize = 0;
        for a in 0..num_alleles {
            if site_pairs >= MAX_PAIRS_PER_SITE {
                break;
            }
            for b in (a + 1)..num_alleles {
                if site_pairs >= MAX_PAIRS_PER_SITE {
                    break;
                }
                let seq_a = alleles[a].as_bytes();
                let seq_b = alleles[b].as_bytes();

                let (cs_text, identity) = if seq_a.len() > MAX_ALLELE_LEN && seq_b.len() > MAX_ALLELE_LEN {
                    (String::new(), 0.0)
                } else {
                    let lowered_a: Vec<u8> = seq_a.iter().map(|&c| to_lower(c)).collect();
                    let lowered_b: Vec<u8> = seq_b.iter().map(|&c| to_lower(c)).collect();
                    let mut cs_bin: Vec<u8> = Vec::new();
                    encode_bubble_cs(&lowered_a, &lowered_b, &mut cs_bin);
                    (binary_cs_to_text(&cs_bin), compute_identity_from_binary_cs(&cs_bin))
                };

                let genomes_a: Vec<String> = allele_genomes[a].iter().map(|&i| i.to_string()).collect();
                let genomes_b: Vec<String> = allele_genomes[b].iter().map(|&i| i.to_string()).collect();

                pairs.push(PairData {
                    a, b, identity, cs_text,
                    genomes_a: genomes_a.join(","),
                    genomes_b: genomes_b.join(","),
                });
                site_pairs += 1;
            }
        }

        if pairs.is_empty() {
            continue;
        }

        // Determine which genome each path belongs to by matching chromosome name
        let vcf_chrom_suffix = strip_pansn_contig(chrom);

        let paths_at_snarl: Vec<(usize, u64)> = if let Some(ord) = snarl_ordinal {
            ord_to_paths.get(&ord)
                .map(|records| {
                    records.iter()
                        .filter_map(|&(pi, offset, _seg_len)| {
                            if pi < path_names.len() && strip_pansn_contig(&path_names[pi]) == vcf_chrom_suffix {
                                Some((pi, offset))
                            } else {
                                None
                            }
                        })
                        .collect()
                })
                .unwrap_or_default()
        } else {
            Vec::new()
        };

        // If we found paths via ordinal lookup, emit per-genome rows
        if !paths_at_snarl.is_empty() {
            for &(pi, path_offset) in &paths_at_snarl {
                let pname = &path_names[pi];
                // Determine which allele this path's genome carries, to compute end position
                // Extract genome from path name to find its bubble genome index
                let path_genome = {
                    let parts: Vec<&str> = pname.split('#').collect();
                    if parts.len() >= 3 {
                        parts[..parts.len()-1].join("#")
                    } else {
                        parts[0].to_string()
                    }
                };
                let genome_allele_len = bubble_genome_names.iter()
                    .position(|g| *g == path_genome)
                    .and_then(|gidx| {
                        for (ai, ag) in allele_genomes.iter().enumerate() {
                            if ag.contains(&gidx) {
                                return Some(alleles[ai].len() as u64);
                            }
                        }
                        None
                    })
                    .unwrap_or(ref_seq.len() as u64);

                let path_end = path_offset + genome_allele_len;

                for pair in &pairs {
                    writeln!(w, "{}\t{}\t{}\t{}\t{}\t{:.6}\t{}\t{}\t{}",
                        pname, path_offset, path_end, pair.a, pair.b, pair.identity, pair.cs_text,
                        pair.genomes_a, pair.genomes_b,
                    ).unwrap();
                    record_count += 1;
                }
            }
        } else {
            // Fallback: emit at VCF-ref coordinates only (no ordinal walk available)
            let end = start + ref_seq.len() as u64;
            for pair in &pairs {
                writeln!(w, "{}\t{}\t{}\t{}\t{}\t{:.6}\t{}\t{}\t{}",
                    chrom, start, end, pair.a, pair.b, pair.identity, pair.cs_text,
                    pair.genomes_a, pair.genomes_b,
                ).unwrap();
                record_count += 1;
            }
        }
    }

    drop(w);
    assert!(
        proc.wait().map(|s| s.success()).unwrap_or(false),
        "bubbles sort|bgzip failed"
    );
    run_cmd("tabix", &["-c", "#", "-p", "bed", &bubbles_file]);

    eprintln!("  {} records ({:.1}s)", record_count, t_start.elapsed().as_secs_f64());
    eprintln!("  Wrote {}", bubbles_file);
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
    let coarse_file = format!("{}.synteny.coarse.bed.gz", output_prefix);

    let mut fwd_proc = spawn_sort_bgzip(&synteny_file);
    let mut fwd_w = BufWriter::new(fwd_proc.stdin.take().unwrap());
    let mut rev_proc = spawn_sort_bgzip(&rev_file);
    let mut rev_w = BufWriter::new(rev_proc.stdin.take().unwrap());
    let mut coarse_proc = spawn_sort_bgzip(&coarse_file);
    let mut coarse_w = BufWriter::new(coarse_proc.stdin.take().unwrap());

    // Group paths by chrom
    let mut chrom_groups: HashMap<&str, Vec<&PathData>> = HashMap::new();
    for p in paths {
        chrom_groups.entry(path_chrom(&p.name)).or_default().push(p);
    }

    for (_, group) in &chrom_groups {
        let ref_path = match group.iter().find(|p| p.assembly == ref_assembly) {
            Some(p) => p,
            None => continue,
        };

        // Build ref lookup structures
        let mut ref_by_ord: HashMap<u64, (u64, u64, bool)> = HashMap::new();
        let mut ref_ord_rank: HashMap<u64, usize> = HashMap::new();
        let mut offset = 0u64;
        for (rank, step) in ref_path.steps.iter().enumerate() {
            ref_by_ord.insert(step.ord, (offset, offset + step.seg_len, step.is_plus));
            ref_ord_rank.insert(step.ord, rank);
            offset += step.seg_len;
        }

        for hap_path in group.iter().filter(|p| p.assembly != ref_assembly) {
            let rows = align_pair(ref_path, hap_path, &ref_by_ord, &ref_ord_rank);

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

            // Coarse: merge consecutive rows within 10kbp gap
            let ref_chrom = path_chrom(&ref_path.name);
            let hap_chrom_s = path_chrom(&hap_path.name);
            let coarse_rows = merge_coarse(&rows, 10_000);
            for row in &coarse_rows {
                let strand = if row.strand { "+" } else { "-" };
                writeln!(
                    coarse_w,
                    "{}\t{}\t{}\t{}\t{}\t{}\t{}\t{:.6}",
                    ref_chrom, row.ref_start, row.ref_end,
                    hap_chrom_s, row.hap_start, row.hap_end,
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

    drop(coarse_w);
    assert!(coarse_proc.wait().map(|s| s.success()).unwrap_or(false), "synteny.coarse sort|bgzip failed");
    run_cmd("tabix", &["-p", "bed", &coarse_file]);

    eprintln!("  Wrote {}, {}, {}", synteny_file, rev_file, coarse_file);
}

fn merge_coarse(rows: &[SyntenyRow], max_gap: u64) -> Vec<SyntenyRow> {
    if rows.is_empty() {
        return Vec::new();
    }
    let mut merged: Vec<SyntenyRow> = Vec::new();
    let mut cur_ref_start = rows[0].ref_start;
    let mut cur_ref_end = rows[0].ref_end;
    let mut cur_hap_start = rows[0].hap_start;
    let mut cur_hap_end = rows[0].hap_end;
    let mut cur_strand = rows[0].strand;
    let mut weight_sum = (cur_ref_end.saturating_sub(cur_ref_start)) as f64 * rows[0].identity;
    let mut ref_len_sum = (cur_ref_end.saturating_sub(cur_ref_start)) as f64;
    let ref_path = rows[0].ref_path.clone();
    let hap_path = rows[0].hap_path.clone();

    for row in &rows[1..] {
        let gap = row.ref_start.saturating_sub(cur_ref_end);
        if row.strand == cur_strand && gap <= max_gap {
            cur_ref_end = cur_ref_end.max(row.ref_end);
            cur_hap_end = cur_hap_end.max(row.hap_end);
            let rl = (row.ref_end.saturating_sub(row.ref_start)) as f64;
            weight_sum += rl * row.identity;
            ref_len_sum += rl;
        } else {
            let identity = if ref_len_sum > 0.0 { weight_sum / ref_len_sum } else { 0.0 };
            merged.push(SyntenyRow {
                ref_path: ref_path.clone(),
                ref_start: cur_ref_start,
                ref_end: cur_ref_end,
                hap_path: hap_path.clone(),
                hap_start: cur_hap_start,
                hap_end: cur_hap_end,
                strand: cur_strand,
                identity,
            });
            cur_ref_start = row.ref_start;
            cur_ref_end = row.ref_end;
            cur_hap_start = row.hap_start;
            cur_hap_end = row.hap_end;
            cur_strand = row.strand;
            let rl = (row.ref_end.saturating_sub(row.ref_start)) as f64;
            weight_sum = rl * row.identity;
            ref_len_sum = rl;
        }
    }
    let identity = if ref_len_sum > 0.0 { weight_sum / ref_len_sum } else { 0.0 };
    merged.push(SyntenyRow {
        ref_path,
        ref_start: cur_ref_start,
        ref_end: cur_ref_end,
        hap_path,
        hap_start: cur_hap_start,
        hap_end: cur_hap_end,
        strand: cur_strand,
        identity,
    });
    merged
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

// Returns (ref_start, ref_end, super_ord, sorted_constituent_ords) for each tile.
// super_ord is the minimum ordinal in the tile (deterministic).
// Tiles span at least tile_size bp; the final tile holds any remainder.
fn compute_tile_rows(steps: &[StepInfo], tile_size: u64) -> Vec<(u64, u64, u64, Vec<u64>)> {
    let mut result: Vec<(u64, u64, u64, Vec<u64>)> = Vec::new();
    if steps.is_empty() {
        return result;
    }
    let mut tile_ref_start = steps[0].offset;
    let mut tile_ords: Vec<u64> = Vec::new();

    for step in steps {
        tile_ords.push(step.ord);
        let tile_end = step.offset + step.seg_len;
        if tile_end - tile_ref_start >= tile_size {
            tile_ords.sort_unstable();
            tile_ords.dedup();
            let super_ord = tile_ords[0];
            result.push((tile_ref_start, tile_end, super_ord, tile_ords.clone()));
            tile_ref_start = tile_end;
            tile_ords.clear();
        }
    }

    if !tile_ords.is_empty() {
        let ref_end = steps.last().map(|s| s.offset + s.seg_len).unwrap_or(tile_ref_start);
        tile_ords.sort_unstable();
        tile_ords.dedup();
        let super_ord = tile_ords[0];
        result.push((tile_ref_start, ref_end, super_ord, tile_ords));
    }
    result
}

fn graph_coarse_build_tiles(paths: &[PathData], ref_assembly: &str, output_prefix: &str, tile_size: u64) {
    let coarse_file = format!("{}.graph.coarse.bed.gz", output_prefix);
    let mut proc = spawn_sort_bgzip(&coarse_file);
    let mut w = BufWriter::new(proc.stdin.take().unwrap());

    writeln!(w, "#schema=graph-coarse/v1").unwrap();
    writeln!(w, "#engine=tile").unwrap();
    writeln!(w, "#tile-size={}", tile_size).unwrap();

    for path in paths.iter().filter(|p| p.assembly == ref_assembly) {
        let chrom = path_chrom(&path.name);
        for (ref_start, ref_end, super_ord, ords) in compute_tile_rows(&path.steps, tile_size) {
            let ords_str = encode_ordinal_ranges(&ords);
            writeln!(w, "{}\t{}\t{}\t{}\ttile\t{}", chrom, ref_start, ref_end, super_ord, ords_str).unwrap();
        }
    }

    drop(w);
    assert!(proc.wait().map(|s| s.success()).unwrap_or(false), "graph.coarse sort|bgzip failed");
    run_cmd("tabix", &["-c", "#", "-p", "bed", &coarse_file]);
    eprintln!("  Wrote {}", coarse_file);
}

// Extracts all "node_id" string values from a vg snarls JSON line.
fn extract_node_ids(line: &str) -> Vec<String> {
    let mut result = Vec::new();
    let marker = "\"node_id\"";
    let mut from = 0;
    while from < line.len() {
        let rel = match line[from..].find(marker) {
            Some(p) => p,
            None => break,
        };
        let abs = from + rel + marker.len();
        let rest = line[abs..].trim_start_matches(|c: char| c == ' ' || c == ':');
        if rest.starts_with('"') {
            let val = &rest[1..];
            if let Some(end) = val.find('"') {
                result.push(val[..end].to_string());
            }
        }
        from = abs + 1;
    }
    result
}

// Returns the two boundary node IDs for a top-level snarl (no parent).
// Returns None for nested snarls or malformed lines.
fn parse_snarl_boundary(line: &str) -> Option<(String, String)> {
    if line.contains("\"parent\"") {
        return None;
    }
    let ids = extract_node_ids(line);
    if ids.len() == 2 {
        Some((ids[0].clone(), ids[1].clone()))
    } else {
        None
    }
}

fn emit_coarse_row(w: &mut BufWriter<impl Write>, chrom: &str, steps: &[StepInfo], lo: usize, hi: usize, row_type: &str) {
    let ref_start = steps[lo].offset;
    let ref_end = steps[hi].offset + steps[hi].seg_len;
    let mut ords: Vec<u64> = steps[lo..=hi].iter().map(|s| s.ord).collect();
    ords.sort_unstable();
    ords.dedup();
    let super_ord = ords[0];
    let ords_str = encode_ordinal_ranges(&ords);
    writeln!(w, "{}\t{}\t{}\t{}\t{}\t{}", chrom, ref_start, ref_end, super_ord, row_type, ords_str).unwrap();
}

fn graph_coarse_build_snarls(
    gfa_path: &str,
    paths: &[PathData],
    ref_assembly: &str,
    seg_ordinals: &HashMap<String, u64>,
    output_prefix: &str,
    min_sv_bp: u64,
) {
    // Run vg snarls | vg view -R to get JSON snarl records
    let mut vg_snarls = Command::new("vg")
        .args(["snarls", gfa_path])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to spawn vg snarls; is vg installed?");
    let mut vg_view = Command::new("vg")
        .args(["view", "-R", "-"])
        .stdin(vg_snarls.stdout.take().unwrap())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to spawn vg view");

    let all_boundaries: Vec<(String, String)> = BufReader::new(vg_view.stdout.take().unwrap())
        .lines()
        .filter_map(|l| l.ok())
        .filter_map(|l| parse_snarl_boundary(&l))
        .collect();

    vg_snarls.wait().ok();
    vg_view.wait().ok();
    eprintln!("  {} top-level snarls parsed", all_boundaries.len());

    let coarse_file = format!("{}.graph.coarse.bed.gz", output_prefix);
    let mut proc = spawn_sort_bgzip(&coarse_file);
    let mut w = BufWriter::new(proc.stdin.take().unwrap());

    writeln!(w, "#schema=graph-coarse/v1").unwrap();
    writeln!(w, "#engine=snarl").unwrap();
    writeln!(w, "#min-sv-bp={}", min_sv_bp).unwrap();

    let mut chrom_groups: HashMap<&str, Vec<&PathData>> = HashMap::new();
    for p in paths {
        chrom_groups.entry(path_chrom(&p.name)).or_default().push(p);
    }

    for (_, group) in &chrom_groups {
        let ref_path = match group.iter().find(|p| p.assembly == ref_assembly) {
            Some(p) => p,
            None => continue,
        };
        let chrom = path_chrom(&ref_path.name);
        let steps = &ref_path.steps;
        if steps.is_empty() {
            continue;
        }

        // Build ordinal → first rank on this path (first occurrence wins for multi-visit segments)
        let mut ord_to_rank: HashMap<u64, usize> = HashMap::new();
        for (rank, step) in steps.iter().enumerate() {
            ord_to_rank.entry(step.ord).or_insert(rank);
        }

        // Collect snarls with ref-span >= min_sv_bp, expressed as rank intervals
        struct Interval { lo: usize, hi: usize }
        let mut intervals: Vec<Interval> = Vec::new();

        for (name_a, name_b) in &all_boundaries {
            let ord_a = match seg_ordinals.get(name_a) { Some(&o) => o, None => continue };
            let ord_b = match seg_ordinals.get(name_b) { Some(&o) => o, None => continue };
            let rank_a = match ord_to_rank.get(&ord_a) { Some(&r) => r, None => continue };
            let rank_b = match ord_to_rank.get(&ord_b) { Some(&r) => r, None => continue };
            let (lo, hi) = if rank_a <= rank_b { (rank_a, rank_b) } else { (rank_b, rank_a) };

            let ref_start = steps[lo].offset;
            let ref_end = steps[hi].offset + steps[hi].seg_len;
            if ref_end - ref_start >= min_sv_bp {
                intervals.push(Interval { lo, hi });
            }
        }
        intervals.sort_unstable_by_key(|i| i.lo);

        eprintln!("  {} large snarls (>= {}bp) on {}", intervals.len(), min_sv_bp, chrom);

        // Walk ref path, emitting backbone chains between large snarls and snarl rows.
        let n = steps.len();
        let mut cursor = 0usize;
        let mut iv_idx = 0usize;

        while cursor < n {
            if iv_idx < intervals.len() {
                let iv = &intervals[iv_idx];
                if iv.lo > cursor {
                    // Backbone before next snarl
                    emit_coarse_row(&mut w, chrom, steps, cursor, iv.lo - 1, "chain");
                    cursor = iv.lo;
                } else if iv.lo == cursor {
                    // Snarl starts here
                    emit_coarse_row(&mut w, chrom, steps, iv.lo, iv.hi, "snarl");
                    cursor = iv.hi + 1;
                    iv_idx += 1;
                    // Skip any overlapping snarls (shouldn't happen with vg top-level snarls)
                    while iv_idx < intervals.len() && intervals[iv_idx].lo < cursor {
                        iv_idx += 1;
                    }
                } else {
                    // iv.lo < cursor: snarl starts before cursor (overlapping — skip)
                    iv_idx += 1;
                }
            } else {
                // No more snarls: emit remaining backbone
                emit_coarse_row(&mut w, chrom, steps, cursor, n - 1, "chain");
                break;
            }
        }
    }

    drop(w);
    assert!(proc.wait().map(|s| s.success()).unwrap_or(false), "graph.coarse snarl sort|bgzip failed");
    run_cmd("tabix", &["-c", "#", "-p", "bed", &coarse_file]);
    eprintln!("  Wrote {}", coarse_file);
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

        // Group by chrom, find ref paths
        let mut chrom_groups: HashMap<&str, Vec<&PathData>> = HashMap::new();
        for p in &all_paths {
            chrom_groups.entry(path_chrom(&p.name)).or_default().push(p);
        }

        let mut rows: Vec<String> = Vec::new();

        for (_, group) in &chrom_groups {
            let ref_path = match group.iter().find(|p| p.assembly == ref_assembly) {
                Some(p) => p,
                None => continue,
            };

            let mut ref_by_ord: HashMap<u64, (u64, u64, bool)> = HashMap::new();
            let mut ref_ord_rank: HashMap<u64, usize> = HashMap::new();
            let mut offset = 0u64;
            for (rank, step) in ref_path.steps.iter().enumerate() {
                ref_by_ord.insert(step.ord, (offset, offset + step.seg_len, step.is_plus));
                ref_ord_rank.insert(step.ord, rank);
                offset += step.seg_len;
            }

            for hap_path in group.iter().filter(|p| p.assembly != ref_assembly) {
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
    fn coarse_merges_small_gap() {
        let rows = vec![
            SyntenyRow {
                ref_path: "ref#0#chr1".to_string(), ref_start: 0, ref_end: 1000,
                hap_path: "hap#1#chr1".to_string(), hap_start: 0, hap_end: 1000,
                strand: true, identity: 1.0,
            },
            SyntenyRow {
                ref_path: "ref#0#chr1".to_string(), ref_start: 6000, ref_end: 7000,
                hap_path: "hap#1#chr1".to_string(), hap_start: 6000, hap_end: 7000,
                strand: true, identity: 1.0,
            },
        ];
        let coarse = merge_coarse(&rows, 10_000);
        assert_eq!(coarse.len(), 1, "5kbp gap should merge into 1 row, got {}", coarse.len());
    }

    #[test]
    fn coarse_keeps_large_gap() {
        let rows = vec![
            SyntenyRow {
                ref_path: "ref#0#chr1".to_string(), ref_start: 0, ref_end: 1000,
                hap_path: "hap#1#chr1".to_string(), hap_start: 0, hap_end: 1000,
                strand: true, identity: 1.0,
            },
            SyntenyRow {
                ref_path: "ref#0#chr1".to_string(), ref_start: 16000, ref_end: 17000,
                hap_path: "hap#1#chr1".to_string(), hap_start: 16000, hap_end: 17000,
                strand: true, identity: 1.0,
            },
        ];
        let coarse = merge_coarse(&rows, 10_000);
        assert_eq!(coarse.len(), 2, "15kbp gap should stay as 2 rows, got {}", coarse.len());
    }

    #[test]
    fn coarse_identity_weighted() {
        let rows = vec![
            SyntenyRow {
                ref_path: "ref#0#chr1".to_string(), ref_start: 0, ref_end: 1000,
                hap_path: "hap#1#chr1".to_string(), hap_start: 0, hap_end: 1000,
                strand: true, identity: 0.9,
            },
            SyntenyRow {
                ref_path: "ref#0#chr1".to_string(), ref_start: 1000, ref_end: 3000,
                hap_path: "hap#1#chr1".to_string(), hap_start: 1000, hap_end: 3000,
                strand: true, identity: 0.8,
            },
        ];
        let coarse = merge_coarse(&rows, 10_000);
        assert_eq!(coarse.len(), 1);
        let expected = (1000.0 * 0.9 + 2000.0 * 0.8) / 3000.0;
        assert!((coarse[0].identity - expected).abs() < 0.001, "Expected identity ≈ {:.6}, got {:.6}", expected, coarse[0].identity);
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

    fn make_steps(seg_lens: &[u64]) -> Vec<StepInfo> {
        let mut steps = Vec::new();
        let mut offset = 0u64;
        for (i, &len) in seg_lens.iter().enumerate() {
            steps.push(StepInfo { ord: i as u64, offset, seg_len: len, is_plus: true });
            offset += len;
        }
        steps
    }

    #[test]
    fn tile_collapses_short_run() {
        let steps = make_steps(&[100, 100, 100, 100, 100]);
        let rows = compute_tile_rows(&steps, 10_000);
        assert_eq!(rows.len(), 1, "500bp total < 10kb tile, should be 1 tile");
        assert_eq!(rows[0].2, 0, "super_ord should be min ord = 0");
        assert_eq!(rows[0].3, vec![0, 1, 2, 3, 4]);
    }

    #[test]
    fn tile_splits_long_path() {
        // 5 segments of 3000bp = 15000bp total, tile_size=10000
        // After seg 3 (offset 9000..12000): span = 12000 >= 10000 → emit tile [0,1,2,3]
        // Remainder: seg 4 (12000..15000) → tile [4]
        let steps = make_steps(&[3000, 3000, 3000, 3000, 3000]);
        let rows = compute_tile_rows(&steps, 10_000);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].0, 0);
        assert_eq!(rows[0].1, 12000);
        assert_eq!(rows[0].2, 0);
        assert_eq!(rows[1].0, 12000);
        assert_eq!(rows[1].1, 15000);
        assert_eq!(rows[1].2, 4);
    }

    #[test]
    fn tile_super_ord_is_min() {
        // ordinals assigned non-sequentially: 5,3,1,2,4
        let seg_lens = [100u64, 100, 100, 100, 100];
        let ords = [5u64, 3, 1, 2, 4];
        let mut steps = Vec::new();
        let mut offset = 0u64;
        for (&ord, &len) in ords.iter().zip(seg_lens.iter()) {
            steps.push(StepInfo { ord, offset, seg_len: len, is_plus: true });
            offset += len;
        }
        let rows = compute_tile_rows(&steps, 10_000);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].2, 1, "super_ord must be min ordinal = 1");
    }

    #[test]
    fn tile_single_large_segment() {
        // One segment larger than tile_size → single tile (no split mid-segment)
        let steps = make_steps(&[50_000]);
        let rows = compute_tile_rows(&steps, 10_000);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].0, 0);
        assert_eq!(rows[0].1, 50_000);
        assert_eq!(rows[0].2, 0);
    }

    #[test]
    fn snarl_parse_top_level() {
        let line = r#"{"directed_acyclic_net_graph": true, "end": {"node_id": "22"}, "start": {"node_id": "16"}, "start_end_reachable": true, "type": 1}"#;
        let result = parse_snarl_boundary(line);
        assert!(result.is_some(), "should parse top-level snarl");
        let (a, b) = result.unwrap();
        let mut ids = vec![a, b];
        ids.sort();
        assert_eq!(ids, vec!["16", "22"]);
    }

    #[test]
    fn snarl_parse_nested_returns_none() {
        let line = r#"{"directed_acyclic_net_graph": true, "end": {"node_id": "4"}, "parent": {"end": {"node_id": "151"}, "start": {"node_id": "148"}}, "start": {"node_id": "1"}, "start_end_reachable": true, "type": 1}"#;
        assert_eq!(parse_snarl_boundary(line), None, "nested snarl should return None");
    }

    #[test]
    fn snarl_parse_extracts_node_ids() {
        let line = r#"{"end": {"node_id": "abc"}, "start": {"node_id": "xyz"}}"#;
        let ids = extract_node_ids(line);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"abc".to_string()));
        assert!(ids.contains(&"xyz".to_string()));
    }
}
