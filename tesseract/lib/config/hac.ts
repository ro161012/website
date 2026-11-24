const DEFAULT_HAC_DISTRICT_URL =
  "https://accesscenter.roundrockisd.org/HomeAccess";
const DEFAULT_HAC_DISTRICT_NAME = "Round Rock ISD";

/**
 * The sign-in form does not require a district address. Use the deployment's
 * configured HAC URL, falling back to the built-in Round Rock ISD host.
 */
export function getHacDistrictUrl(): string {
  return process.env.HAC_DISTRICT_URL?.trim() || DEFAULT_HAC_DISTRICT_URL;
}

/**
 * A human label for the default district. A deployment that changes only
 * HAC_DISTRICT_URL gets its hostname rather than a misleading district name.
 */
export function getHacDistrictName(): string {
  const configured = process.env.HAC_DISTRICT_NAME?.trim();
  if (configured) return configured;
  if (!process.env.HAC_DISTRICT_URL?.trim()) return DEFAULT_HAC_DISTRICT_NAME;
  try {
    return new URL(getHacDistrictUrl()).hostname.replace(/^www\./, "");
  } catch {
    return "Your district";
  }
}
