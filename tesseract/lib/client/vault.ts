"use client";

const VAULT_KEY = "tesseract.vault.v1";
const ITERATIONS = 210_000;

export interface VaultCredentials {
  districtUrl: string;
  username: string;
  password: string;
  districtId?: string;
  districtName?: string;
}

interface VaultRecord {
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function hasVault(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VAULT_KEY) !== null;
  } catch {
    return false;
  }
}

export function vaultCreatedAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as VaultRecord).createdAt ?? null;
  } catch {
    return null;
  }
}

export async function saveVault(
  credentials: VaultCredentials,
  masterPassword: string,
): Promise<void> {
  if (masterPassword.length < 8) {
    throw new Error("Use a master password of at least 8 characters.");
  }
  if (!window.isSecureContext || !crypto.subtle) {
    throw new Error("Saved sign-in needs a secure browser context.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    plaintext,
  );

  const record: VaultRecord = {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString(),
  };
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(record));
}

export async function unlockVault(masterPassword: string): Promise<VaultCredentials> {
  const raw = window.localStorage.getItem(VAULT_KEY);
  if (!raw) throw new Error("There is no saved sign-in on this device.");

  let record: VaultRecord;
  try {
    record = JSON.parse(raw) as VaultRecord;
  } catch {
    throw new Error("The saved sign-in is damaged. Delete it and sign in again.");
  }

  try {
    const salt = base64ToBytes(record.salt);
    const iv = base64ToBytes(record.iv);
    const key = await deriveKey(masterPassword, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(base64ToBytes(record.ciphertext)),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plaintext)) as VaultCredentials;
    if (
      typeof parsed.districtUrl !== "string" ||
      typeof parsed.username !== "string" ||
      typeof parsed.password !== "string" ||
      (parsed.districtId !== undefined && typeof parsed.districtId !== "string") ||
      (parsed.districtName !== undefined && typeof parsed.districtName !== "string")
    ) {
      throw new Error("Saved sign-in is incomplete.");
    }
    return parsed;
  } catch {
    throw new Error("That master password did not unlock the saved sign-in.");
  }
}

export function clearVault(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VAULT_KEY);
  } catch {
    // ignore
  }
}
