# wasix-net

Loopback TCP sockets and a blocking HTTP/1.1 client for programs running in slicc's kernel.

```sh
cargo add wasix-net
cargo add wasix-net --features json
```

`cargo add wasix-net` adds the library. The `json` feature turns on `Request::send_json` and `Response::into_json`.

On `wasm32-wasip1` and `wasm32-wasip1-threads`, `TcpStream`, `TcpListener`, and `ToSocketAddrs` use the WASIX socket calls slicc's kernel implements on its loopback network (`sock_open`, `sock_connect`, `sock_bind`, `sock_listen`, `sock_accept_v2`). Rust std stubs those calls for preview1. On every other target the same types are std's, so a call site needs no `cfg`: keep the import and stay on the API both sides share.

`resolve` answers `localhost` and literal addresses in the realm. Elsewhere it is the system resolver.

There is no TLS. An `https://` URL is sent to the proxy named by `https_proxy`, `http_proxy`, or `all_proxy` (either case) in absolute form (`GET https://example.com/ HTTP/1.1`), and that proxy does TLS. With no proxy, `https://` is an error. `https://` and SOCKS proxy URLs are errors too. Hosts in `no_proxy` are dialed directly. The kernel's `no_proxy` is `localhost,.localhost,127.0.0.1,127.0.0.0/8`, which is how a program reaches the realm's own loopback: the kernel's proxy refuses that loopback, and the client honours `no_proxy`.

```rust
use std::io::{Read, Write};
use wasix_net::TcpStream;

let mut stream = TcpStream::connect("127.0.0.1:8080")?;
stream.write_all(b"ping")?;
let mut buf = [0; 4];
stream.read_exact(&mut buf)?;
```

```rust
let response = wasix_net::http::Agent::new()
    .get("https://example.com/")
    .header("Accept", "text/html")
    .call()?;
println!("{} {}", response.status(), response.into_string()?);
```

The client is blocking HTTP/1.1. Bodies are buffered on the way out, with `Content-Length`. Responses may be chunked, length-delimited, or read to the end of the connection. Redirects are followed, 10 by default. Connections are kept alive and reused.

Rust 1.83 or newer. The license is MIT OR Apache-2.0.
