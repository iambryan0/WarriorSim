//! Native CLI for batch runs and cross-validation against the JS engine.
//! Grows with the port; today it exposes the PRNG for sequence checks:
//!
//!   warriorsim prng --seed 42 --count 10

use warriorsim_engine::rng::Mulberry32;

fn arg(args: &[String], name: &str, fallback: u64) -> u64 {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse().ok())
        .unwrap_or(fallback)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("prng") => {
            let seed = arg(&args, "--seed", 42) as u32;
            let count = arg(&args, "--count", 10);
            let mut rng = Mulberry32::new(seed);
            for _ in 0..count {
                // {:?} prints the shortest representation that round-trips,
                // matching JSON.stringify for these values.
                println!("{:?}", rng.next_f64());
            }
        }
        _ => {
            eprintln!("usage: warriorsim prng [--seed N] [--count N]");
            eprintln!("(simulation subcommands arrive as the port progresses)");
            std::process::exit(2);
        }
    }
}
