// server/src/services/signer/keystore.ts
// Encrypted Web3 Secret Storage signer for self-hosters. The keystore is read
// and decrypted once at boot; the decrypted account remains in memory only.

import { readFile } from "node:fs/promises";
import type {
  Account,
  Address,
  Hex,
  TransactionSerializable,
} from "viem";
import { AbstractSigner, type BaseSignerOptions } from "./base";
import type { SignerContext } from "./types";

export interface KeystoreSignerOptions extends BaseSignerOptions {
  keystorePath: string;
  keystorePassword: string;
  decrypt: (keystoreJson: string, password: string) => Promise<Account>;
  readKeystore?: (path: string) => Promise<string>;
}

export class KeystoreSigner extends AbstractSigner {
  private accountPromise: Promise<Account> | null = null;

  constructor(private readonly keystoreOptions: KeystoreSignerOptions) {
    super(keystoreOptions);
  }

  /** Force decrypt during boot so configuration failures are fail-fast. */
  async initialize(): Promise<void> {
    await this.account();
  }

  private account(): Promise<Account> {
    if (!this.accountPromise) {
      this.accountPromise = (async () => {
        const read =
          this.keystoreOptions.readKeystore ??
          ((path: string) => readFile(path, "utf8"));
        const json = await read(this.keystoreOptions.keystorePath);
        return this.keystoreOptions.decrypt(
          json,
          this.keystoreOptions.keystorePassword
        );
      })();
    }
    return this.accountPromise;
  }

  async getAddress(_chainId: number): Promise<Address> {
    return (await this.account()).address;
  }

  protected async rawSign(
    tx: TransactionSerializable,
    _context: SignerContext
  ): Promise<Hex> {
    const account = await this.account();
    if (!account.signTransaction) {
      throw new Error("decrypted keystore account cannot sign transactions");
    }
    return account.signTransaction(tx);
  }
}
