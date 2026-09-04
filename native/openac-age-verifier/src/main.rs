//! openac-age-verifier
//!
//! A small native HTTP service that checks the 有備而來 (Bonds) OpenAC
//! age-predicate proof pair — a Spartan2/Hyrax `Prepare` proof over the
//! issuer's ES256 SD-JWT signature and a linked `Show` proof over the
//! verifier's nonce and the birth-date predicate. Cloudflare Workers cannot
//! hold the 432 MB Prepare verifying key, so the Worker forwards the proof
//! package here and only ever learns the yes/no verdict and timings.
//!
//! The statement compared against the proofs' public values is reconstructed
//! from values the *verifier* chose (nonce, claim name, claim format, cutoff)
//! plus the issuer key the Worker resolved independently. Nothing the holder
//! sends is trusted as policy. The layout mirrors `predicate.rs` in
//! `bonds-tw/backupTW-iOS/Native/OpenACAge`; any divergence there must be
//! mirrored here or every honest proof will be refused.

use axum::{
    extract::{DefaultBodyLimit, Request, State},
    http::{HeaderMap, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine as _,
};
use ecdsa_spartan2::{load_proof, load_verifying_key, prover::verify_linked, utils::bigint_to_scalar, Scalar, E};
use num_bigint::{BigInt, BigUint};
use num_traits::Num;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use spartan2::{traits::snark::R1CSSNARKTrait, zk_spartan::R1CSSNARK};
use std::{
    fs,
    io::Read,
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::Arc,
    time::Instant,
};
use subtle::ConstantTimeEq;
use tracing::{error, info, warn};

type VerifierKey = <R1CSSNARK<E> as R1CSSNARKTrait<E>>::VerifierKey;

/// Release gate pins for `openac-age-v1` (bonds-tw/backupTW-iOS release).
/// Installed bytes, not the gzip transport.
const PREPARE_VK_SHA256: &str = "9b45cc7462a236b1056d21c19e1e4dfc2cf52fd20538d43fbe072d9ed106e9d6";
const PREPARE_VK_BYTES: u64 = 431_866_442;
const SHOW_VK_SHA256: &str = "f0c447a9757d182e8aa23083bc3dba5a9a22f3e0fcbb344724568cc3c83352d8";
const SHOW_VK_BYTES: u64 = 4_862_746;
const ASSET_RELEASE: &str = "openac-age-v1";

const MAX_PROOF_BYTES: usize = 2_000_000;
const NAME_ID_LENGTH: usize = 31;
const P256_ORDER_HEX: &str = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551";
const BIRTH_CLAIM_NAMES: &[&str] = &[
    "roc_birthday",
    "birthdate",
    "birthday",
    "date_of_birth",
    "birth_date",
    "出生日期",
];

struct Keys {
    prepare: VerifierKey,
    show: VerifierKey,
}

struct AppState {
    keys: Arc<Keys>,
    token: Option<String>,
    started_at: Instant,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyRequest {
    prepare_proof: String,
    show_proof: String,
    nonce: String,
    claim_name: String,
    claim_format: u8,
    cutoff: u64,
    issuer_key_x: String,
    issuer_key_y: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Statement {
    nonce_sha256_prefix: String,
    claim_name: String,
    claim_format: u8,
    cutoff: u64,
    public_value_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VerifyResponse {
    accepted: bool,
    reason: Option<String>,
    /// Deserialising the two proofs from the request body.
    load_ms: u64,
    /// `verify_linked` plus the statement comparison.
    verify_ms: u64,
    prepare_proof_bytes: usize,
    show_proof_bytes: usize,
    statement: Statement,
    asset_release: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Health {
    ok: bool,
    asset_release: &'static str,
    prepare_verifying_key_sha256: &'static str,
    show_verifying_key_sha256: &'static str,
    uptime_seconds: u64,
    auth_required: bool,
}

#[derive(Debug)]
enum Refusal {
    Invalid(String),
}

fn invalid(message: impl Into<String>) -> Refusal {
    Refusal::Invalid(message.into())
}

fn decode_any_base64(value: &str, what: &str) -> Result<Vec<u8>, Refusal> {
    let trimmed = value.trim();
    STANDARD
        .decode(trimmed)
        .or_else(|_| URL_SAFE_NO_PAD.decode(trimmed.trim_end_matches('=')))
        .map_err(|_| invalid(format!("{what} is not base64")))
}

fn decode_url(value: &str, what: &str) -> Result<Vec<u8>, Refusal> {
    URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| invalid(format!("invalid base64url {what}")))
}

fn bigint_decimal(bytes: &[u8]) -> String {
    BigUint::from_bytes_be(bytes).to_str_radix(10)
}

fn decimal_scalar(value: impl AsRef<str>) -> Result<Scalar, Refusal> {
    let integer = BigInt::from_str_radix(value.as_ref(), 10)
        .map_err(|_| invalid("invalid decimal field element"))?;
    bigint_to_scalar(integer).map_err(|_| invalid("field element is outside the P-256 scalar field"))
}

fn p256_order() -> BigUint {
    BigUint::from_str_radix(P256_ORDER_HEX, 16).expect("constant P-256 order")
}

/// Byte-for-byte the layout `predicate.rs::expected_show_values` produces:
/// 156 public values for the compiled `show` circuit.
fn expected_show_values(nonce: &str, claim_name: &str, cutoff: u64) -> Result<Vec<Scalar>, Refusal> {
    let mut decimal = Vec::<String>::new();
    decimal.push("1".to_owned());
    decimal.push(
        (BigUint::from_bytes_be(&Sha256::digest(nonce.as_bytes())) % p256_order()).to_str_radix(10),
    );
    decimal.push("1".to_owned());
    decimal.extend(["0", "0", "0", "2", "0", "0"].into_iter().map(str::to_owned));
    decimal.extend([cutoff.to_string(), "0".to_owned()]);
    decimal.extend(claim_name.as_bytes().iter().map(u8::to_string));
    decimal.extend(std::iter::repeat("0".to_owned()).take(NAME_ID_LENGTH - claim_name.as_bytes().len()));
    decimal.extend(std::iter::repeat("0".to_owned()).take(NAME_ID_LENGTH));
    decimal.extend([claim_name.as_bytes().len().to_string(), "0".to_owned()]);
    decimal.extend(std::iter::repeat("0".to_owned()).take(NAME_ID_LENGTH * 2));
    decimal.extend(["0", "0"].into_iter().map(str::to_owned));
    decimal.extend(std::iter::repeat("0".to_owned()).take(8));
    decimal.extend(std::iter::repeat("0".to_owned()).take(8));
    decimal.push("1".to_owned());
    decimal.into_iter().map(decimal_scalar).collect()
}

fn expected_prepare_values(issuer_x: &[u8], issuer_y: &[u8], claim_format: u8) -> Result<Vec<Scalar>, Refusal> {
    if issuer_x.len() != 32 || issuer_y.len() != 32 {
        return Err(invalid("issuer P-256 coordinates must each be 32 bytes"));
    }
    Ok(vec![
        decimal_scalar(bigint_decimal(issuer_x))?,
        decimal_scalar(bigint_decimal(issuer_y))?,
        decimal_scalar("1")?,
        decimal_scalar("0")?,
        decimal_scalar(claim_format.to_string())?,
        decimal_scalar("1")?,
    ])
}

fn validate_statement(request: &VerifyRequest) -> Result<(), Refusal> {
    if request.nonce.as_bytes().len() < 16 {
        return Err(invalid("verifier nonce is too short"));
    }
    if request.claim_name.as_bytes().len() > NAME_ID_LENGTH
        || !BIRTH_CLAIM_NAMES.contains(&request.claim_name.as_str())
    {
        return Err(invalid("claim is not a supported birth-date field"));
    }
    if ![2, 3].contains(&request.claim_format) {
        return Err(invalid("age claim format must be ISO (2) or ROC (3) date"));
    }
    if request.cutoff == 0 || request.cutoff > 99_999_999 {
        return Err(invalid("cutoff is not a packed calendar date"));
    }
    Ok(())
}

struct Verdict {
    accepted: bool,
    reason: Option<String>,
    load_ms: u64,
    verify_ms: u64,
    public_value_count: usize,
}

fn verify_package(
    keys: &Keys,
    prepare_proof: &[u8],
    show_proof: &[u8],
    expected_prepare: &[Scalar],
    expected_show: &[Scalar],
) -> Result<Verdict, Refusal> {
    // `load_proof` is path based upstream; the proofs are a few hundred KB, so a
    // private temporary directory per request is cheaper than re-implementing
    // its deserialisation against a moving upstream type.
    let scratch = tempfile::tempdir().map_err(|e| invalid(format!("scratch directory unavailable: {e}")))?;
    let prepare_path = scratch.path().join("prepare_proof.bin");
    let show_path = scratch.path().join("show_proof.bin");
    fs::write(&prepare_path, prepare_proof).map_err(|e| invalid(format!("cannot stage proof: {e}")))?;
    fs::write(&show_path, show_proof).map_err(|e| invalid(format!("cannot stage proof: {e}")))?;

    let load_started = Instant::now();
    let prepare = load_proof(&prepare_path).map_err(|_| invalid("prepare proof does not deserialise"))?;
    let show = load_proof(&show_path).map_err(|_| invalid("show proof does not deserialise"))?;
    let load_ms = load_started.elapsed().as_millis() as u64;

    let verify_started = Instant::now();
    let linked = verify_linked(&prepare, &keys.prepare, &show, &keys.show);
    let Some((prepare_public, show_public)) = linked else {
        return Ok(Verdict {
            accepted: false,
            reason: Some("proof pair did not verify or is not linked".to_owned()),
            load_ms,
            verify_ms: verify_started.elapsed().as_millis() as u64,
            public_value_count: 0,
        });
    };
    let prepare_matches = prepare_public == expected_prepare;
    let show_matches = show_public == expected_show;
    let verify_ms = verify_started.elapsed().as_millis() as u64;
    let reason = match (prepare_matches, show_matches) {
        (true, true) => None,
        (false, _) => Some("prepare public values do not match the expected issuer key and claim format".to_owned()),
        (true, false) => Some("show public values do not match the verifier statement".to_owned()),
    };
    Ok(Verdict {
        accepted: reason.is_none(),
        reason,
        load_ms,
        verify_ms,
        public_value_count: prepare_public.len() + show_public.len(),
    })
}

fn authorized(state: &AppState, headers: &HeaderMap) -> bool {
    let Some(expected) = state.token.as_deref() else { return true };
    let Some(value) = headers.get("authorization").and_then(|v| v.to_str().ok()) else { return false };
    let Some(presented) = value.strip_prefix("Bearer ") else { return false };
    presented.as_bytes().ct_eq(expected.as_bytes()).into()
}

async fn healthz(State(state): State<Arc<AppState>>) -> Json<Health> {
    Json(Health {
        ok: true,
        asset_release: ASSET_RELEASE,
        prepare_verifying_key_sha256: PREPARE_VK_SHA256,
        show_verifying_key_sha256: SHOW_VK_SHA256,
        uptime_seconds: state.started_at.elapsed().as_secs(),
        auth_required: state.token.is_some(),
    })
}

/// Runs before the JSON extractor so an unauthenticated caller learns nothing
/// about how the body is parsed.
async fn require_bearer(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response {
    if !authorized(&state, request.headers()) {
        return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "unauthorized" }))).into_response();
    }
    next.run(request).await
}

async fn verify(
    State(state): State<Arc<AppState>>,
    Json(request): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let refuse = |message: String| (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": message })));
    let prepared = (|| -> Result<_, Refusal> {
        validate_statement(&request)?;
        let prepare_proof = decode_any_base64(&request.prepare_proof, "prepare proof")?;
        let show_proof = decode_any_base64(&request.show_proof, "show proof")?;
        if prepare_proof.is_empty() || show_proof.is_empty()
            || prepare_proof.len() > MAX_PROOF_BYTES || show_proof.len() > MAX_PROOF_BYTES {
            return Err(invalid("proof artifact is empty or larger than any real proof"));
        }
        let issuer_x = decode_url(&request.issuer_key_x, "issuer x")?;
        let issuer_y = decode_url(&request.issuer_key_y, "issuer y")?;
        let expected_prepare = expected_prepare_values(&issuer_x, &issuer_y, request.claim_format)?;
        let expected_show = expected_show_values(&request.nonce, &request.claim_name, request.cutoff)?;
        Ok((prepare_proof, show_proof, expected_prepare, expected_show))
    })()
    .map_err(|Refusal::Invalid(message)| refuse(message))?;
    let (prepare_proof, show_proof, expected_prepare, expected_show) = prepared;

    let keys = state.keys.clone();
    let prepare_len = prepare_proof.len();
    let show_len = show_proof.len();
    let outcome = tokio::task::spawn_blocking(move || {
        verify_package(&keys, &prepare_proof, &show_proof, &expected_prepare, &expected_show)
    })
    .await;
    let verdict = match outcome {
        Ok(Ok(verdict)) => verdict,
        Ok(Err(Refusal::Invalid(message))) => return Err(refuse(message)),
        Err(join) => {
            error!("verification task panicked: {join}");
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "verification task failed" })),
            ));
        }
    };
    let nonce_prefix = hex::encode(&Sha256::digest(request.nonce.as_bytes())[..8]);
    info!(
        accepted = verdict.accepted,
        load_ms = verdict.load_ms,
        verify_ms = verdict.verify_ms,
        claim = %request.claim_name,
        format = request.claim_format,
        cutoff = request.cutoff,
        nonce = %nonce_prefix,
        "verified age proof pair"
    );
    Ok(Json(VerifyResponse {
        accepted: verdict.accepted,
        reason: verdict.reason,
        load_ms: verdict.load_ms,
        verify_ms: verdict.verify_ms,
        prepare_proof_bytes: prepare_len,
        show_proof_bytes: show_len,
        statement: Statement {
            nonce_sha256_prefix: nonce_prefix,
            claim_name: request.claim_name,
            claim_format: request.claim_format,
            cutoff: request.cutoff,
            public_value_count: verdict.public_value_count,
        },
        asset_release: ASSET_RELEASE,
    }))
}

fn sha256_file(path: &Path) -> std::io::Result<(String, u64)> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 8 * 1024 * 1024];
    let mut total = 0u64;
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 { break; }
        hasher.update(&buffer[..read]);
        total += read as u64;
    }
    Ok((hex::encode(hasher.finalize()), total))
}

fn check_pin(path: &Path, expected_sha: &str, expected_bytes: u64) -> Result<(), String> {
    let (sha, bytes) = sha256_file(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if bytes != expected_bytes || sha != expected_sha {
        return Err(format!(
            "{} does not match the {ASSET_RELEASE} pin (bytes {bytes} vs {expected_bytes}, sha256 {sha})",
            path.display()
        ));
    }
    Ok(())
}

fn load_keys(directory: &Path) -> Result<Keys, String> {
    let prepare_path = directory.join("prepare_verifying.key");
    let show_path = directory.join("show_verifying.key");
    for (path, sha, bytes) in [
        (&prepare_path, PREPARE_VK_SHA256, PREPARE_VK_BYTES),
        (&show_path, SHOW_VK_SHA256, SHOW_VK_BYTES),
    ] {
        if !path.exists() {
            return Err(format!(
                "{} is missing; run scripts/download-keys.sh (release {ASSET_RELEASE})",
                path.display()
            ));
        }
        check_pin(path, sha, bytes)?;
    }
    let started = Instant::now();
    let prepare = load_verifying_key(&prepare_path).map_err(|e| format!("prepare verifying key: {e}"))?;
    let show = load_verifying_key(&show_path).map_err(|e| format!("show verifying key: {e}"))?;
    info!(ms = started.elapsed().as_millis() as u64, "verifying keys loaded and pinned");
    Ok(Keys { prepare, show })
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env().add_directive("info".parse().unwrap()))
        .init();

    let keys_dir = PathBuf::from(std::env::var("OPENAC_AGE_KEYS_DIR").unwrap_or_else(|_| "keys".to_owned()));
    let bind: SocketAddr = std::env::var("OPENAC_AGE_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8787".to_owned())
        .parse()
        .expect("OPENAC_AGE_BIND must be host:port");
    let token = std::env::var("OPENAC_AGE_VERIFIER_TOKEN").ok().filter(|value| !value.is_empty());
    if token.is_none() {
        if std::env::var("OPENAC_AGE_ALLOW_UNAUTHENTICATED").as_deref() != Ok("1") {
            eprintln!("refusing to start without OPENAC_AGE_VERIFIER_TOKEN (set OPENAC_AGE_ALLOW_UNAUTHENTICATED=1 for a loopback-only experiment)");
            std::process::exit(64);
        }
        warn!("running without a bearer token; keep this bound to loopback");
    }

    let keys = match load_keys(&keys_dir) {
        Ok(keys) => Arc::new(keys),
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(65);
        }
    };
    let state = Arc::new(AppState { keys, token, started_at: Instant::now() });
    let app = Router::new()
        .route("/healthz", get(healthz))
        .route(
            "/verify",
            post(verify).layer(middleware::from_fn_with_state(state.clone(), require_bearer)),
        )
        .layer(DefaultBodyLimit::max(8 * 1024 * 1024))
        .with_state(state);
    let listener = tokio::net::TcpListener::bind(bind).await.expect("bind");
    info!(%bind, "openac-age-verifier listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; })
        .await
        .expect("serve");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn show_statement_has_the_compiled_public_width() {
        let values = expected_show_values("0123456789abcdef", "roc_birthday", 970_901).unwrap();
        assert_eq!(values.len(), 156);
    }

    #[test]
    fn relabelled_claims_are_refused() {
        let request = VerifyRequest {
            prepare_proof: "AA==".into(), show_proof: "AA==".into(),
            nonce: "0123456789abcdef".into(), claim_name: "membership_started_at".into(),
            claim_format: 2, cutoff: 20_000_101, issuer_key_x: String::new(), issuer_key_y: String::new(),
        };
        assert!(matches!(validate_statement(&request), Err(Refusal::Invalid(_))));
    }

    #[test]
    fn short_nonces_are_refused() {
        let request = VerifyRequest {
            prepare_proof: "AA==".into(), show_proof: "AA==".into(),
            nonce: "short".into(), claim_name: "birthdate".into(),
            claim_format: 2, cutoff: 20_000_101, issuer_key_x: String::new(), issuer_key_y: String::new(),
        };
        assert!(validate_statement(&request).is_err());
    }

    #[test]
    fn prepare_statement_is_six_values() {
        let x = [7u8; 32];
        let y = [9u8; 32];
        let values = expected_prepare_values(&x, &y, 3).unwrap();
        assert_eq!(values.len(), 6);
        assert_eq!(values[4], decimal_scalar("3").unwrap());
    }

    #[test]
    fn base64_variants_decode() {
        assert_eq!(decode_any_base64("AQID", "x").unwrap(), vec![1, 2, 3]);
        assert_eq!(decode_any_base64("AQID\n", "x").unwrap(), vec![1, 2, 3]);
        assert!(decode_any_base64("not base64!", "x").is_err());
    }
}
