use std::io::{ErrorKind, Read, Write};
use std::time::{Duration, Instant};
use wasix_net::{TcpListener, TcpStream};

fn main() -> std::io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let mut client = TcpStream::connect(listener.local_addr()?)?;
    let (mut peer, _) = listener.accept()?;
    let timeout = Duration::from_millis(600);
    client.set_read_timeout(Some(timeout))?;
    client.set_nonblocking(true)?;
    let mut byte = [0u8; 1];
    let started = Instant::now();
    assert_eq!(
        client.read(&mut byte).unwrap_err().kind(),
        ErrorKind::WouldBlock
    );
    println!(
        "nonblocking read: WouldBlock in {} ms",
        started.elapsed().as_millis()
    );
    assert_eq!(client.read_timeout()?, Some(timeout));
    let mut clone = client.try_clone()?;
    clone.set_nonblocking(true)?;
    assert_eq!(
        clone.read(&mut byte).unwrap_err().kind(),
        ErrorKind::WouldBlock
    );
    client.set_nonblocking(false)?;
    client.set_read_timeout(Some(Duration::from_millis(100)))?;
    assert_eq!(
        client.read(&mut byte).unwrap_err().kind(),
        ErrorKind::TimedOut
    );
    println!("blocking read: TimedOut");
    client.set_read_timeout(Some(timeout))?;
    client.set_write_timeout(Some(timeout))?;
    client.set_nonblocking(true)?;
    client.write_all(b"x")?;
    assert_eq!(peer.read(&mut byte)?, 1);
    assert_eq!(byte, [b'x']);
    peer.write_all(b"y")?;
    client.set_nonblocking(false)?;
    assert_eq!(client.read(&mut byte)?, 1);
    assert_eq!(byte, [b'y']);
    assert_eq!(client.read_timeout()?, Some(timeout));
    assert_eq!(client.write_timeout()?, Some(timeout));
    println!("socket options preserved");
    Ok(())
}
