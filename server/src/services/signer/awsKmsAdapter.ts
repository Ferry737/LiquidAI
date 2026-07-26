// server/src/services/signer/awsKmsAdapter.ts
// v1.7: Reference adapter wrapping @aws-sdk/client-kms into a KmsClientLike.
// Loaded ONLY at runtime (dynamic import) when SIGNER_PROVIDER=kms, so the AWS
// SDK stays an optional dependency and this file never blocks the build/tests.
//
// It performs the three things a raw KMS secp256k1 signer must do to produce a
// valid Ethereum signature:
//   1. Fetch the DER-encoded SPKI public key, derive the address.
//   2. Ask KMS to sign the 32-byte digest (ECDSA_SHA_256 over a raw digest via
//      MessageType=DIGEST).
//   3. Decode the DER signature to (r, s), apply low-S normalization, and
//      recover the correct v by trying both parities against the known address.

import {
  keccak256,
  recoverAddress,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import type { KmsClientLike } from "./kms";

// secp256k1 curve order (n) for low-S normalization.
const SECP256K1_N =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const HALF_N = SECP256K1_N / 2n;

interface KmsSdkModule {
  KMSClient: new (cfg: { region?: string }) => {
    send: (cmd: unknown) => Promise<{
      PublicKey?: Uint8Array;
      Signature?: Uint8Array;
    }>;
  };
  GetPublicKeyCommand: new (i: { KeyId: string }) => unknown;
  SignCommand: new (i: {
    KeyId: string;
    Message: Uint8Array;
    MessageType: string;
    SigningAlgorithm: string;
  }) => unknown;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): Hex {
  let s = "0x";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s as Hex;
}

/** Extract the 64-byte uncompressed public key from a DER SPKI structure. */
function publicKeyFromSpki(spki: Uint8Array): Hex {
  // The uncompressed EC point starts with 0x04; find it near the end (65 bytes).
  const idx = spki.lastIndexOf(0x04);
  const point = spki.slice(idx, idx + 65);
  return bytesToHex(point);
}

/** Decode a DER ECDSA signature into (r, s) big-endian 32-byte hex. */
function decodeDerSignature(der: Uint8Array): { r: bigint; s: bigint } {
  // SEQUENCE(0x30) len INT(0x02) rlen r INT(0x02) slen s
  let offset = 2;
  offset++; // INT tag
  const rLen = der[offset++];
  const r = BigInt(bytesToHex(der.slice(offset, offset + rLen)));
  offset += rLen;
  offset++; // INT tag
  const sLen = der[offset++];
  const s = BigInt(bytesToHex(der.slice(offset, offset + sLen)));
  return { r, s };
}

function toHex32(n: bigint): Hex {
  return `0x${n.toString(16).padStart(64, "0")}` as Hex;
}

/** Derive an Ethereum address from a 65-byte uncompressed pubkey (0x04||X||Y). */
function addressFromPublicKey(pubKey: Hex): Address {
  // Drop the 0x04 prefix, keccak256 the 64-byte body, take the last 20 bytes.
  const body = `0x${pubKey.slice(4)}` as Hex;
  const hash = keccak256(body);
  return getAddress(`0x${hash.slice(-40)}`);
}

export function buildKmsClient(
  sdkUnknown: unknown,
  opts: { keyId: string; region?: string }
): KmsClientLike {
  const sdk = sdkUnknown as KmsSdkModule;
  const client = new sdk.KMSClient({ region: opts.region });
  let cachedAddress: Address | null = null;
  let cachedPubKey: Hex | null = null;

  async function loadPublicKey(): Promise<{ address: Address; pubKey: Hex }> {
    if (cachedAddress && cachedPubKey) {
      return { address: cachedAddress, pubKey: cachedPubKey };
    }
    const res = await client.send(
      new sdk.GetPublicKeyCommand({ KeyId: opts.keyId })
    );
    if (!res.PublicKey) throw new Error("KMS GetPublicKey returned no key");
    const pubKey = publicKeyFromSpki(res.PublicKey);
    const address = addressFromPublicKey(pubKey);
    cachedPubKey = pubKey;
    cachedAddress = address;
    return { address, pubKey };
  }

  return {
    async getAddress(): Promise<Address> {
      return (await loadPublicKey()).address;
    },

    async signDigest(digest: Hex): Promise<Hex> {
      const { address } = await loadPublicKey();
      const res = await client.send(
        new sdk.SignCommand({
          KeyId: opts.keyId,
          Message: hexToBytes(digest),
          MessageType: "DIGEST",
          SigningAlgorithm: "ECDSA_SHA_256",
        })
      );
      if (!res.Signature) throw new Error("KMS Sign returned no signature");
      let { r, s } = decodeDerSignature(res.Signature);
      // Low-S normalization (EIP-2).
      if (s > HALF_N) s = SECP256K1_N - s;

      // Recover v by trying both parities against the known address.
      const rHex = toHex32(r);
      const sHex = toHex32(s);
      for (const yParity of [0, 1] as const) {
        const recovered = await recoverAddress({
          hash: digest,
          signature: { r: rHex, s: sHex, yParity },
        });
        if (recovered.toLowerCase() === address.toLowerCase()) {
          const v = (27 + yParity).toString(16).padStart(2, "0");
          return `${rHex}${sHex.slice(2)}${v}` as Hex;
        }
      }
      throw new Error("KMS signature recovery failed");
    },
  };
}
