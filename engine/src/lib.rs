//! WarriorSim engine core (Rust port, PROMPT.MD Phase 3).
//!
//! Port order: rng -> weapon -> spell -> player -> simulation, each module
//! validated against the JS engine under matched seeds before the next
//! begins. See MIGRATION.md for the running log.

pub mod rng;
