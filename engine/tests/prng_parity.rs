//! Bit-exact parity of the Rust mulberry32 against the JS engine's own
//! implementation. The golden file is generated from js/rng.ts by
//! gen-golden.mjs (checked in; regenerate if js/rng.ts ever changes).

use warriorsim_engine::rng::Mulberry32;

#[test]
fn matches_js_sequences_bit_for_bit() {
    let golden = include_str!("prng-golden.json");
    // Tiny state-walk parser over {"seed": ["hexbits", ...], ...} to stay
    // zero-dependency: quoted tokens are either a seed (parses as u32) or a
    // 16-char hex string of f64 bits for the current seed's next draw.
    let mut seed: Option<u32> = None;
    let mut rng: Option<Mulberry32> = None;
    let mut checked = 0usize;
    for token in golden.split('"').skip(1).step_by(2) {
        if let Ok(s) = token.parse::<u32>() {
            seed = Some(s);
            rng = Some(Mulberry32::new(s));
            continue;
        }
        if token.len() == 16 {
            let expected_bits = u64::from_str_radix(token, 16).expect("hex float bits");
            let got = rng.as_mut().expect("draw before seed").next_f64().to_bits();
            assert_eq!(
                got, expected_bits,
                "seed {:?}: draw diverged (got {:016x}, want {})",
                seed, got, token
            );
            checked += 1;
        }
    }
    assert_eq!(checked, 5 * 64, "expected 5 seeds x 64 draws");
}

#[test]
fn rng_helpers_truncate_like_js() {
    // ~~x truncates toward zero; both helpers ride the same draw stream.
    let mut a = Mulberry32::new(42);
    let mut b = Mulberry32::new(42);
    for _ in 0..1000 {
        let raw = a.next_f64();
        assert_eq!(b.rng10k(), (raw * 10_000.0) as i64);
    }
    let mut c = Mulberry32::new(7);
    let mut d = Mulberry32::new(7);
    for _ in 0..1000 {
        let raw = c.next_f64();
        assert_eq!(d.rng(50_000, 60_000), (raw * 10_001.0) as i64 + 50_000);
    }
}
