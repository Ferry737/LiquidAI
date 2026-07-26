// server/src/services/signer/kms.ts
// v1.7: KmsSigner — signs via an AWS KMS asymmetric secp256k1 key. The private
// key NEVER leaves KMS: we send a 32-byte digest to KMS and receive a
// signature back.
//
// The AWS SDK is an OPTIONAL peer dependency. To keep the codebase buildable
// (and unit-testable) without it, this module depends only on a small
// KmsClientLike interface. The production adapter that wraps
// @aws-sdk/client-kms is created lazily by `createAwsKmsClient` and is only
// imported when SIGNER_PROVIDER=kms at boot.

import {
  keccak256,
  serializeTransaction,
  type Address,
  type Hex,
  type TransactionSerializable,
} from "viem";
import { AbstractSigner, type BaseSignerOptions } from "./base";
import type { SignerContext } from "./types";

/**
 * Minimal contract the signer needs from a KMS backend. The production adapter
 * handles DER-signature decoding, low-S normalization, and recovery-id
 * computation to produce a 65-byte Ethereum signature. Tests provide a mock.
 */
export interface KmsClientLike {
  /** Ethereum address derived from the KMS public key (secp256k1). */
  getAddress(): Promise<Address>;
  /** Sign a 32-byte keccak digest, returning a 65-byte r||s||v hex signature. */
  signDigest(digest: Hex): Promise<Hex>;
}

export interface KmsSignerOptions extends BaseSignerOptions {
  client: KmsClientLike;
}

export class KmsSigner extends AbstractSigner {
  constructor(private readonly kmsOpts: KmsSignerOptions) {
    super(kmsOpts);
  }

  async getAddress(_chainId: number): Promise<Address> {
    return this.kmsOpts.client.getAddress();
  }

  protected async rawSign(
    tx: TransactionSerializable,
    _context: SignerContext
  ): Promise<Hex> {
    // Serialize the unsigned tx, hash it, and have KMS sign the digest. KMS
    // returns a full r||s||v signature; we attach it to the serialized tx.
    const unsigned = serializeTransaction(tx);
    const digest = keccak256(unsigned);
    const signature = await this.kmsOpts.client.signDigest(digest);
    const r = `0x${signature.slice(2, 66)}` as Hex;
    const s = `0x${signature.slice(66, 130)}` as Hex;
    const vByte = parseInt(signature.slice(130, 132), 16);
    const yParity = vByte % 2 === 0 ? 0 : 1;
    return serializeTransaction(tx, { r, s, yParity });
  }
}

/**
 * Lazily build the production KMS client adapter around @aws-sdk/client-kms.
 * Imported dynamically so the SDK is only required when actually using KMS.
 * NOTE: throws a clear error if the SDK is not installed.
 */
export async function createAwsKmsClient(opts: {
  keyId: string;
  region?: string;
}): Promise<KmsClientLike> {
  let sdk: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdk = await import(/* @vite-ignore */ "@aws-sdk/client-kms" as string);
  } catch {
    throw new Error(
      "SIGNER_PROVIDER=kms requires the '@aws-sdk/client-kms' package to be installed"
    );
  }
  // The concrete adapter (DER decode + recovery) is implemented in the
  // reference adapter file; wiring it requires the SDK types at runtime.
  const { buildKmsClient } = (await import(
    /* @vite-ignore */ "./awsKmsAdapter" as string
  )) as {
    buildKmsClient: (
      sdk: unknown,
      o: { keyId: string; region?: string }
    ) => KmsClientLike;
  };
  return buildKmsClient(sdk, opts);
}
