# wasix-net

TCP sockets and a blocking HTTP/1.1 client for slicc's kernel. `wasm32-wasip1` and `wasm32-wasip1-threads` use WASIX sockets. Every other target uses std. No TLS: `https://` goes through the kernel proxy, and `no_proxy` dials loopback directly.

Rust 1.83. `cargo add wasix-net`. Feature `json` adds `send_json` and `into_json`. `npm test` runs `test/integration`: `cargo test` on stable and 1.83.0, `wasix-net-http` inside `@ai-ecoverse/slicc-kernel` on both WASI targets, and a publish dry run. `npm run lint` adds fmt and clippy. No CLAUDE.md. CI is `ci.yml` on slicc-shared-web's `pipeline.yml`: semantic-release on `main` tags a release, then the `crates` job publishes it to crates.io. The committed crate version stays `0.1.0`; that job stamps the tag.
