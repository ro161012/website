import { NextResponse, type NextRequest } from "next/server";
import { guardDirectory } from "@/lib/api/guards";
import { apiJson, handleApi } from "@/lib/api/route";
import { CookieJar } from "@/lib/hac/cookies";
import { parseDistrictDirectory } from "@/lib/hac/districts";
import { fetchHacPage } from "@/lib/hac/http";
import { profileForDistrictUrl } from "@/lib/hac/profiles";
import { joinHacPath, normalizeDistrictUrl } from "@/lib/hac/url";
import { InvalidDistrictInputProblem } from "@/lib/security/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    guardDirectory(request);

    const raw = request.nextUrl.searchParams.get("url")?.trim() ?? "";
    if (!raw) {
      throw new InvalidDistrictInputProblem(
        "Enter a HAC address before searching for districts.",
      );
    }

    const district = normalizeDistrictUrl(raw);
    const profile = profileForDistrictUrl(district.baseUrl);
    const page = await fetchHacPage({
      url: joinHacPath(district.baseUrl, profile.paths.login),
      jar: new CookieJar(),
      profile,
    });
    const directory = parseDistrictDirectory(page.html);

    if (!directory) {
      return apiJson(
        {
          url: district.baseUrl,
          field: null,
          options: [] as Array<{ id: string; name: string }>,
          selectedId: null,
        },
        [
          {
            code: "district_picker_missing",
            message:
              "This HAC address does not show a district picker. Paste your own district's HAC address instead.",
          },
        ],
      );
    }

    return apiJson({
      url: district.baseUrl,
      field: directory.field,
      options: directory.options,
      selectedId: directory.selectedId,
    });
  });
}
