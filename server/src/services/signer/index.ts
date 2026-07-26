// server/src/services/signer/index.ts
// Signer provider selection and encrypted-keystore bootstrap. No raw signing key
// is accepted from environment or API input.

import {
  createDecipheriv,
  pbkdf2Sync,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { keccak256, type Account, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../../lib/config";
import { AbstractSigner } from "./base";
import { KeystoreSigner } from "./keystore";
import { KmsSigner, createAwsKmsClient, type KmsClientLike } from "./kms";
import type { SignerService } from "./types";

export { SignerRefusedError } from "./types";
export type { SignerService, SignerContext } from "./types";
export { KmsSigner } from "./kms";
export type { KmsClientLike } from "./kms";
export { KeystoreSigner } from "./keystore";
export { AbstractSigner } from "./base";

export interface SignerSelectionConfig {
  provider: "kms" | "keystore";
  mainnetExecutionEnabled: () => boolean;
  kmsKeyId?: string;
  awsRegion?: string;
  keystorePath?: string;
  keystorePassword?: string;
}

export interface SignerSelectionDependencies {
  kmsClient?: KmsClientLike;
  readKeystore?: (path: string) => Promise<string>;
  decryptKeystore?: (json: string, password: string) => Promise<Account>;
}

export function mainnetExecutionEnabled(): boolean {
  return config.MAINNET_EXECUTION_ENABLED === true;
}

/** Purely configurable selector used by boot code and unit tests. */
export async function selectSignerProvider(
  selection: SignerSelectionConfig,
  dependencies: SignerSelectionDependencies = {}
): Promise<SignerService> {
  const common = {
    mainnetExecutionEnabled: selection.mainnetExecutionEnabled,
  };

  if (selection.provider === "kms") {
    if (!selection.kmsKeyId && !dependencies.kmsClient) {
      throw new Error("SIGNER_PROVIDER=kms requires KMS_KEY_ID");
    }
    const client =
      dependencies.kmsClient ??
      (await createAwsKmsClient({
        keyId: selection.kmsKeyId!,
        region: selection.awsRegion,
      }));
    return new KmsSigner({ ...common, client });
  }

  if (!selection.keystorePath || !selection.keystorePassword) {
    throw new Error(
      "SIGNER_PROVIDER=keystore requires KEYSTORE_PATH and KEYSTORE_PASSWORD"
    );
  }
  const signer = new KeystoreSigner({
    ...common,
    keystorePath: selection.keystorePath,
    keystorePassword: selection.keystorePassword,
    decrypt: dependencies.decryptKeystore ?? decryptKeystoreV3,
    readKeystore: dependencies.readKeystore,
  });
  await signer.initialize();
  return signer;
}

/** Build the configured process-wide signer; called once by the worker at boot. */
export function createSignerService(): Promise<SignerService> {
  return selectSignerProvider({
    provider: config.SIGNER_PROVIDER,
    mainnetExecutionEnabled,
    kmsKeyId: config.KMS_KEY_ID,
    awsRegion: config.AWS_REGION,
    keystorePath: config.KEYSTORE_PATH,
    keystorePassword: config.KEYSTORE_PASSWORD,
  });
}

interface KeystoreCrypto {
  kdf: "scrypt" | "pbkdf2";
  kdfparams: {
    dklen: number;
    salt: string;
    n?: number;
    r?: number;
    p?: number;
    c?: number;
    prf?: string;
  };
  cipher: "aes-128-ctr";
  cipherparams: { iv: string };
  ciphertext: string;
  mac: string;
}

/** Decrypt geth/Web3 Secret Storage v3 using Node crypto only. */
export async function decryptKeystoreV3(
  keystoreJson: string,
  password: string
): Promise<Account> {
  const parsed = JSON.parse(keystoreJson) as {
    version?: number;
    crypto?: KeystoreCrypto;
    Crypto?: KeystoreCrypto;
  };
  if (parsed.version !== undefined && parsed.version !== 3) {
    throw new Error("unsupported keystore version");
  }
  const crypto = parsed.crypto ?? parsed.Crypto;
  if (!crypto) throw new Error("invalid keystore: missing crypto section");
  if (crypto.cipher !== "aes-128-ctr") {
    throw new Error(`unsupported keystore cipher: ${crypto.cipher}`);
  }

  const passwordBytes = Buffer.from(password, "utf8");
  const salt = Buffer.from(crypto.kdfparams.salt, "hex");
  let derived: Buffer;
  if (crypto.kdf === "scrypt") {
    derived = scryptSync(passwordBytes, salt, crypto.kdfparams.dklen, {
      N: crypto.kdfparams.n,
      r: crypto.kdfparams.r,
      p: crypto.kdfparams.p,
      maxmem: 512 * 1024 * 1024,
    });
  } else if (crypto.kdf === "pbkdf2") {
    if (
      crypto.kdfparams.prf &&
      crypto.kdfparams.prf.toLowerCase() !== "hmac-sha256"
    ) {
      throw new Error(`unsupported PBKDF2 PRF: ${crypto.kdfparams.prf}`);
    }
    derived = pbkdf2Sync(
      passwordBytes,
      salt,
      crypto.kdfparams.c!,
      crypto.kdfparams.dklen,
      "sha256"
    );
  } else {
    throw new Error("unsupported keystore KDF");
  }

  const ciphertext = Buffer.from(crypto.ciphertext, "hex");
  const expectedMac = Buffer.from(crypto.mac, "hex");
  const actualMac = Buffer.from(
    keccak256(Buffer.concat([derived.subarray(16, 32), ciphertext])).slice(2),
    "hex"
  );
  if (
    expectedMac.length !== actualMac.length ||
    !timingSafeEqual(expectedMac, actualMac)
  ) {
    derived.fill(0);
    throw new Error("keystore MAC mismatch: wrong password or corrupt file");
  }

  const decipher = createDecipheriv(
    "aes-128-ctr",
    derived.subarray(0, 16),
    Buffer.from(crypto.cipherparams.iv, "hex")
  );
  const keyBytes = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  if (keyBytes.length !== 32) {
    derived.fill(0);
    keyBytes.fill(0);
    throw new Error("invalid decrypted keystore key length");
  }
  const account = privateKeyToAccount(`0x${keyBytes.toString("hex")}` as Hex);
  keyBytes.fill(0);
  derived.fill(0);
  passwordBytes.fill(0);
  return account;
}
