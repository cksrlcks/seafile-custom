//! 바로 보내기 TLS. 실행마다 새 자체 서명 인증서를 만들고 그 지문(SHA-256)을 mDNS로 알린다.
//! 보내는 쪽은 연결한 상대의 인증서가 mDNS로 알린 지문과 같을 때만 보낸다(다른 PC가 주소를 가로채 대신 받지 못하게).
//! 받는 쪽은 보낸 사람을 확인하지 않는다(메신저처럼 받을지는 사용자가 정한다). 오가는 내용은 TLS 1.3으로 암호화된다

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::crypto::{ring as provider, CryptoProvider, WebPkiSupportedAlgorithms};
use rustls::pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime};
use rustls::{ClientConfig, ClientConnection, DigitallySignedStruct, ServerConfig, ServerConnection, SignatureScheme, StreamOwned};
use std::io;
use std::net::TcpStream;
use std::sync::Arc;

/// 인증서에 넣는 이름. 지문으로 확인하므로 이름은 보지 않는다
const NAME: &str = "u-drive";

fn crypto() -> Arc<CryptoProvider> {
    Arc::new(provider::default_provider())
}

/// 인증서 DER의 SHA-256(소문자 16진수)
pub fn fingerprint(cert: &[u8]) -> String {
    ring::digest::digest(&ring::digest::SHA256, cert).as_ref().iter().map(|b| format!("{b:02x}")).collect()
}

/// 이 실행의 받기용 인증서
pub struct Identity {
    pub fingerprint: String,
    server: Arc<ServerConfig>,
}

impl Identity {
    pub fn new() -> Result<Self, String> {
        let key = rcgen::KeyPair::generate().map_err(|e| e.to_string())?;
        let cert = rcgen::CertificateParams::new(vec![NAME.into()]).and_then(|p| p.self_signed(&key)).map_err(|e| e.to_string())?;
        let der = cert.der().clone();
        let fingerprint = fingerprint(&der);
        let key = PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(key.serialize_der()));
        let server = ServerConfig::builder_with_provider(crypto())
            .with_protocol_versions(&[&rustls::version::TLS13])
            .map_err(|e| e.to_string())?
            .with_no_client_auth()
            .with_single_cert(vec![der], key)
            .map_err(|e| e.to_string())?;
        Ok(Identity { fingerprint, server: Arc::new(server) })
    }

    /// 받는 쪽. 핸드셰이크는 처음 읽을 때 한다(소켓의 읽기 시간 제한이 그대로 걸린다)
    pub fn accept(&self, sock: TcpStream) -> io::Result<StreamOwned<ServerConnection, TcpStream>> {
        let conn = ServerConnection::new(self.server.clone()).map_err(io::Error::other)?;
        Ok(StreamOwned::new(conn, sock))
    }
}

/// 보내는 쪽. 상대 인증서 지문이 fp가 아니면 핸드셰이크에서 InvalidData로 실패한다(헤더도 보내지 않는다)
pub fn connect(sock: TcpStream, fp: &str) -> io::Result<StreamOwned<ClientConnection, TcpStream>> {
    let crypto = crypto();
    let verifier = Pinned { fp: fp.to_string(), algs: crypto.signature_verification_algorithms };
    let cfg = ClientConfig::builder_with_provider(crypto)
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(io::Error::other)?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(verifier))
        .with_no_client_auth();
    let conn = ClientConnection::new(Arc::new(cfg), ServerName::try_from(NAME).map_err(io::Error::other)?).map_err(io::Error::other)?;
    let mut s = StreamOwned::new(conn, sock);
    while s.conn.is_handshaking() {
        s.conn.complete_io(&mut s.sock)?;
    }
    Ok(s)
}

/// 인증서 체인 대신 mDNS로 받은 지문과 같은지만 본다. 핸드셰이크 서명은 그대로 확인한다(인증서만 베껴서는 통과 못 한다)
#[derive(Debug)]
struct Pinned {
    fp: String,
    algs: WebPkiSupportedAlgorithms,
}

impl ServerCertVerifier for Pinned {
    fn verify_server_cert(&self, end_entity: &CertificateDer<'_>, _: &[CertificateDer<'_>], _: &ServerName<'_>, _: &[u8], _: UnixTime) -> Result<ServerCertVerified, rustls::Error> {
        if fingerprint(end_entity) == self.fp {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::General("상대 기기의 인증서가 알린 것과 다릅니다".into()))
        }
    }

    fn verify_tls12_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.algs)
    }

    fn verify_tls13_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.algs)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.algs.supported_schemes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;

    /// 받는 쪽 흉내: 한 줄 읽고 "ok"로 답한다
    fn echo_server(id: Arc<Identity>) -> (std::net::SocketAddr, std::thread::JoinHandle<Option<String>>) {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = l.local_addr().unwrap();
        let h = std::thread::spawn(move || {
            let (s, _) = l.accept().unwrap();
            let mut r = BufReader::new(id.accept(s).unwrap());
            let mut line = String::new();
            r.read_line(&mut line).ok()?;
            r.get_mut().write_all(b"ok\n").ok()?;
            r.get_mut().flush().ok()?;
            Some(line)
        });
        (addr, h)
    }

    #[test]
    fn connects_when_fingerprint_matches() {
        let id = Arc::new(Identity::new().unwrap());
        assert_eq!(id.fingerprint.len(), 64);
        let (addr, h) = echo_server(id.clone());
        let mut s = connect(TcpStream::connect(addr).unwrap(), &id.fingerprint).unwrap();
        s.write_all(b"hello\n").unwrap();
        s.flush().unwrap();
        let mut reply = String::new();
        BufReader::new(&mut s).read_line(&mut reply).unwrap();
        assert_eq!(reply, "ok\n");
        assert_eq!(h.join().unwrap().as_deref(), Some("hello\n"));
    }

    #[test]
    fn refuses_other_certificate() {
        // 주소를 가로챈 PC: 자기 인증서로는 알린 지문을 맞출 수 없다
        let real = Identity::new().unwrap();
        let attacker = Arc::new(Identity::new().unwrap());
        let (addr, h) = echo_server(attacker);
        let err = connect(TcpStream::connect(addr).unwrap(), &real.fingerprint).unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::InvalidData, "{err}");
        assert_eq!(h.join().unwrap(), None);
    }

    #[test]
    fn identities_differ_per_run() {
        assert_ne!(Identity::new().unwrap().fingerprint, Identity::new().unwrap().fingerprint);
    }
}
