use std::collections::{HashMap, HashSet};
use std::env;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 || args.iter().any(|a| a == "-h" || a == "--help") {
        eprintln!(
            "Usage: gfa-to-tabix <gfa-file> [output-prefix] [--chunk-size N] [--assemblies a,b,c]"
        );
        eprintln!("Converts GFA to tabix-indexed pos.bed.gz + segs.bed.gz files.");
        eprintln!("Streaming two-pass approach: O(segments) memory, handles multi-GB GFA files.");
        std::process::exit(if args.len() < 2 { 1 } else { 0 });
    }

    let gfa_path = &args[1];
    let output_prefix = if args.len() > 2 && !args[2].starts_with('-') {
        args[2].clone()
    } else {
        gfa_path
            .trim_end_matches(".gz")
            .trim_end_matches(".gfa")
            .to_string()
    };

    let mut chunk_size: usize = 100;
    let mut assemblies_filter: Option<HashSet<String>> = None;

    let mut i = 2;
    while i < args.len() {
        if args[i] == "--chunk-size" && i + 1 < args.len() {
            chunk_size = args[i + 1].parse().expect("Invalid chunk-size");
            i += 2;
        } else if args[i] == "--assemblies" && i + 1 < args.len() {
            assemblies_filter = Some(args[i + 1].split(',').map(|s| s.to_string()).collect());
            i += 2;
        } else {
            i += 1;
        }
    }

    // Pass 1: Read S-lines, store segment ID → (ordinal, length)
    eprintln!("Pass 1: Reading segment definitions...");
    let mut seg_lengths: HashMap<String, u64> = HashMap::new();
    let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
    let mut next_ordinal: u64 = 0;

    let reader1 = open_file(gfa_path);
    for line in reader1.lines() {
        let line = line.expect("Failed to read line");
        if !line.starts_with("S\t") {
            continue;
        }
        let mut parts = line.splitn(4, '\t');
        parts.next(); // skip "S"
        let name = parts.next().expect("Missing segment name").to_string();
        let seq = parts.next().expect("Missing segment sequence");

        let length = if let Some(rest) = parts.next() {
            rest.split('\t')
                .find(|t| t.starts_with("LN:i:"))
                .map(|t| t[5..].parse::<u64>().unwrap_or(0))
                .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 })
        } else if seq == "*" {
            0
        } else {
            seq.len() as u64
        };

        if !seg_ordinals.contains_key(&name) {
            seg_ordinals.insert(name.clone(), next_ordinal);
            next_ordinal += 1;
        }
        seg_lengths.insert(name, length);
    }

    eprintln!("  {} segments, {} ordinals", seg_lengths.len(), next_ordinal);

    // Pass 2: Read paths/walks, stream-write output
    eprintln!("Pass 2: Processing paths...");

    let pos_file = format!("{}.pos.bed.gz", output_prefix);
    let segs_file = format!("{}.segs.bed.gz", output_prefix);

    let mut pos_proc = spawn_sort_bgzip(&pos_file);
    let mut segs_proc = spawn_sort_bgzip(&segs_file);

    let mut pos_w = BufWriter::new(pos_proc.stdin.take().unwrap());
    let mut segs_w = BufWriter::new(segs_proc.stdin.take().unwrap());

    let mut genomes: Vec<String> = Vec::new();
    let mut genome_set: HashSet<String> = HashSet::new();
    let mut path_sizes: Vec<(String, u64)> = Vec::new();
    let mut path_count: u64 = 0;

    let reader2 = open_file(gfa_path);
    for line in reader2.lines() {
        let line = line.expect("Failed to read line");

        if line.starts_with("W\t") {
            let parts: Vec<&str> = line.splitn(8, '\t').collect();
            if parts.len() < 7 {
                continue;
            }
            let sample = parts[1];
            let haplotype = parts[2];
            let sequence = parts[3];
            let walk_str = parts[6];
            let path_name = format!("{}#{}#{}", sample, haplotype, sequence);
            let assembly = format!("{}#{}", sample, haplotype);

            if let Some(ref filter) = assemblies_filter {
                if !filter.contains(&assembly) {
                    continue;
                }
            }

            if genome_set.insert(assembly.clone()) {
                genomes.push(assembly);
            }

            let total = process_walk(
                &path_name,
                walk_str,
                chunk_size,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut pos_w,
                &mut segs_w,
            );
            path_sizes.push((path_name, total));
            path_count += 1;
        } else if line.starts_with("P\t") {
            let parts: Vec<&str> = line.splitn(4, '\t').collect();
            if parts.len() < 3 {
                continue;
            }
            let raw_name = parts[1];
            let seg_list = parts[2];

            let (sample, sequence) = match raw_name.rfind('#') {
                Some(idx) => (&raw_name[..idx], &raw_name[idx + 1..]),
                None => (raw_name, raw_name),
            };
            let path_name = format!("{}#{}", sample, sequence);

            if let Some(ref filter) = assemblies_filter {
                if !filter.contains(&sample.to_string()) {
                    continue;
                }
            }

            if genome_set.insert(sample.to_string()) {
                genomes.push(sample.to_string());
            }

            let total = process_p_line(
                &path_name,
                seg_list,
                chunk_size,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut pos_w,
                &mut segs_w,
            );
            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }

    // Write headers (# sorts before all alphanumeric chars)
    let header = format!("#genomes={}\n", genomes.join(","));
    pos_w.write_all(header.as_bytes()).unwrap();
    segs_w.write_all(header.as_bytes()).unwrap();

    let sizes: Vec<String> = path_sizes
        .iter()
        .map(|(name, size)| format!("{}:{}", name, size))
        .collect();
    let sizes_header = format!("#sizes={}\n", sizes.join(","));
    pos_w.write_all(sizes_header.as_bytes()).unwrap();
    segs_w.write_all(sizes_header.as_bytes()).unwrap();

    drop(pos_w);
    drop(segs_w);

    let pos_ok = pos_proc.wait().map(|s| s.success()).unwrap_or(false);
    let segs_ok = segs_proc.wait().map(|s| s.success()).unwrap_or(false);
    if !pos_ok || !segs_ok {
        eprintln!("Error: sort|bgzip failed");
        std::process::exit(1);
    }

    eprintln!("Indexing with tabix...");
    run_tabix(&pos_file);
    run_tabix_segs(&segs_file);

    eprintln!("Done.");
    eprintln!("  Segments: {}", seg_lengths.len());
    eprintln!("  Paths: {}", path_count);
    eprintln!("  Genomes: {} ({})", genomes.len(), genomes.join(", "));
    eprintln!("  Output: {}, {}", pos_file, segs_file);
}

fn open_file(path: &str) -> Box<dyn BufRead> {
    if path.ends_with(".gz") {
        let child = Command::new("gzip")
            .args(["-dc", path])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap_or_else(|_| panic!("Failed to spawn gzip for {}", path));
        Box::new(BufReader::with_capacity(
            1024 * 1024,
            child.stdout.unwrap(),
        ))
    } else {
        let file = File::open(path).unwrap_or_else(|_| panic!("Failed to open {}", path));
        Box::new(BufReader::with_capacity(1024 * 1024, file))
    }
}

fn spawn_sort_bgzip(output: &str) -> std::process::Child {
    Command::new("sh")
        .args([
            "-c",
            &format!(
                "sort -t\"\t\" -k1,1 -k2,2n | bgzip > \"{}\"",
                output
            ),
        ])
        .env("LC_ALL", "C")
        .stdin(Stdio::piped())
        .spawn()
        .unwrap_or_else(|_| panic!("Failed to spawn sort|bgzip for {}", output))
}

fn process_walk(
    path_name: &str,
    walk_str: &str,
    chunk_size: usize,
    seg_lengths: &HashMap<String, u64>,
    seg_ordinals: &mut HashMap<String, u64>,
    next_ordinal: &mut u64,
    pos_w: &mut BufWriter<impl Write>,
    segs_w: &mut BufWriter<impl Write>,
) -> u64 {
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_min_ord: u64 = u64::MAX;
    let mut chunk_max_ord: u64 = 0;
    let mut steps_in_chunk: usize = 0;
    let bytes = walk_str.as_bytes();
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
        let seg_id = &walk_str[start..pos];
        let seg_len = seg_lengths.get(seg_id).copied().unwrap_or(0);
        let ord = get_or_assign_ordinal(seg_ordinals, next_ordinal, seg_id);

        writeln!(
            segs_w,
            "S\t{}\t{}\t{}\t{}\t{}\t{}",
            ord,
            path_name,
            offset,
            seg_len,
            orient,
            seg_id
        )
        .unwrap();

        chunk_min_ord = chunk_min_ord.min(ord);
        chunk_max_ord = chunk_max_ord.max(ord);
        offset += seg_len;
        steps_in_chunk += 1;

        if steps_in_chunk >= chunk_size {
            writeln!(
                pos_w,
                "{}\t{}\t{}\t{}\t{}",
                path_name, chunk_start, offset, chunk_min_ord, chunk_max_ord
            )
            .unwrap();
            chunk_start = offset;
            chunk_min_ord = u64::MAX;
            chunk_max_ord = 0;
            steps_in_chunk = 0;
        }
    }

    if steps_in_chunk > 0 {
        writeln!(
            pos_w,
            "{}\t{}\t{}\t{}\t{}",
            path_name, chunk_start, offset, chunk_min_ord, chunk_max_ord
        )
        .unwrap();
    }

    offset
}

fn process_p_line(
    path_name: &str,
    seg_list: &str,
    chunk_size: usize,
    seg_lengths: &HashMap<String, u64>,
    seg_ordinals: &mut HashMap<String, u64>,
    next_ordinal: &mut u64,
    pos_w: &mut BufWriter<impl Write>,
    segs_w: &mut BufWriter<impl Write>,
) -> u64 {
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_min_ord: u64 = u64::MAX;
    let mut chunk_max_ord: u64 = 0;
    let mut steps_in_chunk: usize = 0;

    for step in seg_list.split(',') {
        let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
            let o = if step.ends_with('+') { "+" } else { "-" };
            (&step[..step.len() - 1], o)
        } else {
            (step, "+")
        };

        let seg_len = seg_lengths.get(seg_id).copied().unwrap_or(0);
        let ord = get_or_assign_ordinal(seg_ordinals, next_ordinal, seg_id);

        writeln!(
            segs_w,
            "S\t{}\t{}\t{}\t{}\t{}\t{}",
            ord,
            path_name,
            offset,
            seg_len,
            orient,
            seg_id
        )
        .unwrap();

        chunk_min_ord = chunk_min_ord.min(ord);
        chunk_max_ord = chunk_max_ord.max(ord);
        offset += seg_len;
        steps_in_chunk += 1;

        if steps_in_chunk >= chunk_size {
            writeln!(
                pos_w,
                "{}\t{}\t{}\t{}\t{}",
                path_name, chunk_start, offset, chunk_min_ord, chunk_max_ord
            )
            .unwrap();
            chunk_start = offset;
            chunk_min_ord = u64::MAX;
            chunk_max_ord = 0;
            steps_in_chunk = 0;
        }
    }

    if steps_in_chunk > 0 {
        writeln!(
            pos_w,
            "{}\t{}\t{}\t{}\t{}",
            path_name, chunk_start, offset, chunk_min_ord, chunk_max_ord
        )
        .unwrap();
    }

    offset
}

fn get_or_assign_ordinal(
    ordinals: &mut HashMap<String, u64>,
    next: &mut u64,
    seg_id: &str,
) -> u64 {
    if let Some(&ord) = ordinals.get(seg_id) {
        ord
    } else {
        let ord = *next;
        *next += 1;
        ordinals.insert(seg_id.to_string(), ord);
        ord
    }
}

fn run_tabix(file: &str) {
    let status = Command::new("tabix")
        .args(["-c", "#", "-p", "bed", file])
        .status()
        .unwrap_or_else(|_| panic!("Failed to run tabix on {}", file));
    if !status.success() {
        eprintln!("Warning: tabix failed for {}", file);
    }
}

fn run_tabix_segs(file: &str) {
    let status = Command::new("tabix")
        .args(["-0", "-s", "1", "-b", "2", "-e", "2", "-c", "#", file])
        .status()
        .unwrap_or_else(|_| panic!("Failed to run tabix on {}", file));
    if !status.success() {
        eprintln!("Warning: tabix failed for {}", file);
    }
}
