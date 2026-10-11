use std::io::{self, Write};
use std::process::exit;
use std::time::Duration;

use wasix_net::http::{Agent, Error};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    exit(http(&args));
}

fn unhex(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hex"))
        .collect()
}

fn http(args: &[String]) -> i32 {
    let (Some(method), Some(url)) = (args.first(), args.get(1)) else {
        return 2;
    };
    let mut headers = Vec::new();
    let mut body: Option<Vec<u8>> = None;
    let mut json = false;
    let mut redirects = None;
    let mut timeout = None;
    let mut i = 2;
    while i < args.len() {
        let value = args.get(i + 1).map(String::as_str).unwrap_or("");
        match args[i].as_str() {
            "-H" => {
                let Some((name, header_value)) = value.split_once(':') else {
                    return 2;
                };
                headers.push((name.trim().to_string(), header_value.trim().to_string()));
                i += 1;
            }
            "--data" => {
                body = Some(value.as_bytes().to_vec());
                i += 1;
            }
            "--data-hex" => {
                body = Some(unhex(value));
                i += 1;
            }
            "--json" => {
                body = Some(value.as_bytes().to_vec());
                json = true;
                i += 1;
            }
            "--redirects" => {
                let Ok(count) = value.parse() else {
                    return 2;
                };
                redirects = Some(count);
                i += 1;
            }
            "--timeout-ms" => {
                let Ok(ms) = value.parse() else {
                    return 2;
                };
                timeout = Some(Duration::from_millis(ms));
                i += 1;
            }
            _ => return 2,
        }
        i += 1;
    }
    let mut builder = Agent::builder();
    if let Some(count) = redirects {
        builder = builder.redirects(count);
    }
    if let Some(limit) = timeout {
        builder = builder.timeout(limit);
    }
    let mut request = builder.build().request(method, url);
    for (name, value) in &headers {
        request = request.header(name, value);
    }
    let result = match (body, json) {
        (Some(bytes), true) => {
            let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
                return 2;
            };
            request.send_json(&value)
        }
        (Some(bytes), false) => request.send(&bytes),
        (None, _) => request.call(),
    };
    let response = match result {
        Ok(response) => response,
        Err(error) => {
            let kind = match &error {
                Error::TlsUnsupported(_) => "tls-unsupported",
                Error::Connect { .. } => "connect",
                Error::Io(_) => "io",
                Error::TooManyRedirects(_) => "too-many-redirects",
                _ => "other",
            };
            eprintln!("error {kind}: {error}");
            return 3;
        }
    };
    let mut out = format!("status {}\nurl {}\n", response.status(), response.url());
    for (name, value) in response.headers() {
        out.push_str(&format!("header {}: {value}\n", name.to_ascii_lowercase()));
    }
    out.push('\n');
    let mut stdout = io::stdout().lock();
    stdout.write_all(out.as_bytes()).unwrap();
    io::copy(&mut response.into_reader(), &mut stdout).unwrap();
    stdout.flush().unwrap();
    0
}
