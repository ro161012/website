export interface HacDistrictOption {
  id: string;
  name: string;
}

export interface HacDistrictDirectory {
  /** Name of the HAC form field that carries the district selection. */
  field: string;
  options: HacDistrictOption[];
  selectedId: string | null;
}

export interface HacNetwork {
  id: string;
  label: string;
  url: string;
  note: string;
}

/**
 * Shared HAC hosts with a district picker. This is deliberately a short list
 * of verified networks, not a claim to be a national district directory.
 * Any other HAC address can be searched from the sign-in form.
 */
export const HAC_NETWORKS: readonly HacNetwork[] = [
  {
    id: "arkansas",
    label: "Arkansas HAC",
    url: "https://hac23.esp.k12.ar.us/HomeAccess",
    note: "Arkansas public school districts",
  },
  {
    id: "eschoolplus-multi",
    label: "eSchoolPLUS multi-district HAC",
    url: "https://esp41pehac.eschoolplus.powerschool.com/HomeAccess",
    note: "Districts across several states",
  },
  {
    id: "texas",
    label: "Texas HAC",
    url: "https://esp41pwhac.eschoolplus.powerschool.com/HomeAccess",
    note: "Texas school districts",
  },
  {
    id: "lower-hudson",
    label: "Lower Hudson HAC (NY)",
    url: "https://hac.lhric.org/HomeAccess",
    note: "Lower Hudson Valley districts",
  },
  {
    id: "sparcc",
    label: "SPARCC HAC (OH)",
    url: "https://hac.sparcc.org/HomeAccess",
    note: "Northeast Ohio districts",
  },
  {
    id: "osse",
    label: "OSSE HAC (DC)",
    url: "https://oss-hac.eschoolplus.powerschool.com/HomeAccess",
    note: "District of Columbia schools",
  },
] as const;
