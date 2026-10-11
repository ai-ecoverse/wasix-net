# wasix-net

TCP sockets and a blocking HTTP/1.1 client for slicc's kernel. `wasm32-wasip1` and `wasm32-wasip1-threads` use WASIX sockets. Every other target uses std. No TLS: `https://` goes through the kernel proxy, and `no_proxy` dials loopback directly.

Rust 1.83. `cargo add wasix-net`. Feature `json` adds `send_json` and `into_json`. `cargo test` runs the host tests. `test/integration` runs `wasix-net-http` inside `@ai-ecoverse/slicc-kernel` 1.56.0. No CLAUDE.md. semantic-release on `main` publishes to crates.io. The committed crate version stays `0.1.0`; the release job stamps the tag.
