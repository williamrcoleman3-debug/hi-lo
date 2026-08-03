import { AppStoreServerAPIClient, APIError, APIException, Environment, SignedDataVerifier } from "@apple/app-store-server-library";

export const BUNDLE_ID = "com.halifaxwaterco.hilo";
export const REMOVE_ADS_PRODUCT_ID = "com.halifaxwaterco.hilo.removeads";

// Apple Root CA - G3 (the root StoreKit 2 / App Store Server signed data
// chains up to), fetched from https://www.apple.com/certificateauthority/
// AppleRootCA-G3.cer and inlined as base64 DER so this function has no
// external file to fail to bundle -- SignedDataVerifier takes root certs
// as raw DER Buffers, not PEM.
const APPLE_ROOT_CA_G3_BASE64 =
  "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

function appleRootCertificates() {
  return [Buffer.from(APPLE_ROOT_CA_G3_BASE64, "base64")];
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env var ${name}`);
  return value;
}

// App Store Connect API key credentials -- set as Netlify environment
// variables (Site configuration -> Environment variables), never
// committed. APPLE_PRIVATE_KEY is the raw contents of the downloaded .p8
// file (PEM text), pasted in as-is.
function apiClientFor(environment) {
  return new AppStoreServerAPIClient(
    requireEnv("APPLE_PRIVATE_KEY"),
    requireEnv("APPLE_KEY_ID"),
    requireEnv("APPLE_ISSUER_ID"),
    BUNDLE_ID,
    environment
  );
}

function verifierFor(environment) {
  const appAppleId = process.env.APPLE_APP_APPLE_ID ? Number(process.env.APPLE_APP_APPLE_ID) : undefined;
  return new SignedDataVerifier(appleRootCertificates(), true, environment, BUNDLE_ID, appAppleId);
}

// Fetches and verifies a single transaction by id. Tries Production
// first, then falls back to Sandbox on Apple's documented "transaction
// not found" error -- this is what lets TestFlight/sandbox purchases
// verify correctly without a separate manual environment toggle, exactly
// as Apple's own docs recommend for this endpoint. Returns both the
// verified/decoded payload and the raw signed JWS Apple returned, so the
// caller can store the raw value for audit purposes without re-fetching.
export async function fetchAndVerifyTransaction(transactionId) {
  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const client = apiClientFor(environment);
      const response = await client.getTransactionInfo(transactionId);
      const verifier = verifierFor(environment);
      const decoded = await verifier.verifyAndDecodeTransaction(response.signedTransactionInfo);
      return { decoded, raw: response.signedTransactionInfo };
    } catch (err) {
      const isNotFound = err instanceof APIException && err.apiError === APIError.TRANSACTION_ID_NOT_FOUND;
      if (isNotFound && environment === Environment.PRODUCTION) continue;
      throw err;
    }
  }
  throw new Error("transaction not found in Production or Sandbox");
}

// Verifies an App Store Server Notifications v2 signedPayload. Tries the
// Production verifier first, then Sandbox -- a notification's own
// environment is embedded in the signed data itself and checked against
// what the verifier was constructed with, so this mirrors the same
// fallback used for transaction lookups above.
export async function verifyNotificationPayload(signedPayload) {
  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = verifierFor(environment);
      return await verifier.verifyAndDecodeNotification(signedPayload);
    } catch (err) {
      if (environment === Environment.PRODUCTION) continue;
      throw err;
    }
  }
  throw new Error("could not verify notification payload against Production or Sandbox");
}

// The nested transaction JWS inside a notification's data.signedTransactionInfo
// is signed the same way as a direct API response -- verified with the same
// environment-fallback approach.
export async function verifyNestedTransaction(signedTransactionInfo) {
  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = verifierFor(environment);
      return await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    } catch (err) {
      if (environment === Environment.PRODUCTION) continue;
      throw err;
    }
  }
  throw new Error("could not verify nested transaction against Production or Sandbox");
}
