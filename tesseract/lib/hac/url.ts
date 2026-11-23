import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { HttpsUrlSchema } from "@/lib/types";
import {
  ForbiddenHostProblem,
  InvalidDistrictInputProblem,
  UpstreamProblem,
} from "@/lib/security/errors";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface ResolvedTarget {
  url: URL;
  hostname: string;
  addresses: ResolvedAddress[];
}

export interface NormalizedDistrict {
  baseUrl: string;
  hostname: string;
}

const blockedV4List = new BlockList();
const blockedV6List = new BlockList();

const blockedV4Networks: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

for (const [network, prefix] of blockedV4Networks) {
  blockedV4List.addSubnet(network, prefix, "ipv4");
}
blockedV4List.addAddress("255.255.255.255", "ipv4");

const blockedV6Networks: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];

for (const [network, prefix] of blockedV6Networks) {
  blockedV6List.addSubnet(network, prefix, "ipv6");
}
// IPv4-mapped IPv6 can bypass a plain IPv4 check. Block the whole mapped
// range on the IPv6 list; public dotted forms are still classified via v4.
blockedV6List.addSubnet("::ffff:0:0", 96, "ipv6");

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/\.$/, "");
}

function mappedIpv4Address(address: string): string | null {
  const match = /^::ffff:(.+)$/i.exec(address);
  if (!match?.[1]) return null;
  const suffix = match[1];
  if (suffix.includes(".")) return isIP(suffix) === 4 ? suffix : null;

  const parts = suffix.split(":");
  if (parts.length !== 2) return null;
  if (!parts.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) return null;
  const high = Number.parseInt(parts[0] ?? "", 16);
  const low = Number.parseInt(parts[1] ?? "", 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isPrivateAddress(address: string): boolean {
  const bare = address.split("%")[0]?.trim() ?? "";
  const mapped = mappedIpv4Address(bare);
  if (mapped) return isPrivateAddress(mapped);

  const version = isIP(bare);
  if (version === 4) return blockedV4List.check(bare, "ipv4");
  if (version === 6) return blockedV6List.check(bare, "ipv6");
  return true;
}

function allowedHostSuffixes(): string[] {
  return (process.env.HAC_ALLOWED_HOST_SUFFIXES ?? "")
    .split(",")
    .map((suffix) => normalizeHostname(suffix).replace(/^\./, ""))
    .filter(Boolean);
}

export function isHostAllowlisted(hostname: string): boolean {
  const suffixes = allowedHostSuffixes();
  if (suffixes.length === 0) return true;
  const host = normalizeHostname(hostname);
  return suffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return true;
  if (isIP(host) !== 0) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.endsWith(".home.arpa") || host.endsWith(".arpa")) return true;
  return false;
}

function assertHostPolicy(hostname: string): string {
  const host = normalizeHostname(hostname);
  if (isBlockedHostname(host)) {
    throw new ForbiddenHostProblem("IP literals, local and private hosts are not allowed.");
  }
  if (!isHostAllowlisted(host)) {
    throw new ForbiddenHostProblem(
      "This district is not in the configured HAC allowlist.",
    );
  }
  return host;
}

function assertPort(url: URL): void {
  if (url.port !== "" && url.port !== "443") {
    throw new ForbiddenHostProblem("District HAC connections must use HTTPS port 443.");
  }
}

export function normalizeDistrictUrl(raw: string): NormalizedDistrict {
  const parsed = HttpsUrlSchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new InvalidDistrictInputProblem(
      parsed.error.issues[0]?.message ??
        "Enter the complete HTTPS address of your district's HAC.",
    );
  }

  const url = new URL(parsed.data);
  assertPort(url);
  const hostname = assertHostPolicy(url.hostname);
  url.hostname = hostname;

  const trimmedPath = url.pathname.replace(/\/+$/, "");
  const baseUrl = `${url.origin}${trimmedPath}`;

  return { baseUrl, hostname };
}

export async function resolveHost(hostname: string): Promise<ResolvedAddress[]> {
  let results: Array<{ address: string; family: number }>;
  try {
    results = await lookup(normalizeHostname(hostname), {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new ForbiddenHostProblem("The district host could not be resolved.");
  }

  if (!results.length) {
    throw new ForbiddenHostProblem("The district host could not be resolved.");
  }

  const addresses: ResolvedAddress[] = [];
  for (const result of results) {
    if (result.family !== 4 && result.family !== 6) {
      throw new ForbiddenHostProblem("The district host resolved to an unsupported address.");
    }
    if (isPrivateAddress(result.address)) {
      throw new ForbiddenHostProblem("The district host resolved to a private address.");
    }
    addresses.push({ address: result.address, family: result.family });
  }

  return addresses;
}

/**
 * Validate every request URL, including redirect targets. Query strings are
 * allowed here because login return URLs commonly use them; userinfo is not.
 */
export async function resolveRequestTarget(
  url: URL,
  options: { allowQuery?: boolean } = {},
): Promise<ResolvedTarget> {
  if (url.protocol !== "https:") {
    throw new ForbiddenHostProblem("Only HTTPS district URLs are allowed.");
  }
  if (url.username || url.password) {
    throw new ForbiddenHostProblem("Credentials cannot be placed in a URL.");
  }
  if (url.hash) {
    throw new ForbiddenHostProblem("A district URL cannot contain a fragment.");
  }
  if (options.allowQuery === false && url.search) {
    throw new InvalidDistrictInputProblem(
      "A district URL cannot contain a query string or fragment.",
    );
  }

  assertPort(url);
  const hostname = assertHostPolicy(url.hostname);
  url.hostname = hostname;
  const addresses = await resolveHost(hostname);

  return { url, hostname, addresses };
}

function sameOrSsoHost(
  targetHost: string,
  initialHost: string,
  ssoSuffixes: readonly string[],
): boolean {
  if (targetHost === initialHost) return true;
  const host = normalizeHostname(targetHost);
  return ssoSuffixes.some((suffix) => {
    const normalized = normalizeHostname(suffix).replace(/^\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

export function assertRedirectHostAllowed(
  targetHost: string,
  initialHost: string,
  ssoSuffixes: readonly string[],
): void {
  if (!sameOrSsoHost(targetHost, initialHost, ssoSuffixes)) {
    throw new ForbiddenHostProblem(
      "HAC redirected to a host that is not allowed for this district.",
    );
  }
}

export function joinHacPath(baseUrl: string, path: string): URL {
  const base = new URL(baseUrl);
  const target = new URL(path, base.origin);
  if (target.origin !== base.origin) {
    throw new UpstreamProblem("The district profile contains an invalid path.");
  }
  return target;
}
