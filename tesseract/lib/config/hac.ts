const DEFAULT_HAC_DISTRICT_URL =
  "https://accesscenter.roundrockisd.org/HomeAccess";

/**
 * The sign-in form no longer asks for a district address. Use the deployment's
 * configured HAC URL, falling back to the built-in Round Rock ISD host.
 */
export function getHacDistrictUrl(): string {
  return process.env.HAC_DISTRICT_URL?.trim() || DEFAULT_HAC_DISTRICT_URL;
}
