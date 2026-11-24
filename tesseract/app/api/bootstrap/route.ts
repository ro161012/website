import { NextResponse, type NextRequest } from "next/server";
import { handleApi, providerJson } from "@/lib/api/route";
import { guardData } from "@/lib/api/guards";
import { getProvider } from "@/lib/providers";
import { readSession } from "@/lib/session/current";
import { InvalidInputProblem } from "@/lib/security/errors";
import { CoursesQuerySchema, type Warning } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dedupeWarnings(warnings: Warning[]): Warning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}|${warning.message}|${warning.path ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * One round trip for the dashboard boot: me, the marking period's courses and
 * the upcoming window. The provider's schedule cache means these three reads
 * share a single HAC schedule page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleApi(async () => {
    const session = readSession(request);
    guardData(request, session);

    const raw = request.nextUrl.searchParams.get("mp") ?? undefined;
    const parsed = CoursesQuerySchema.safeParse({ mp: raw });
    if (!parsed.success) {
      throw new InvalidInputProblem(
        parsed.error.issues[0]?.message ?? "Choose a valid marking period.",
      );
    }

    const provider = getProvider(session);
    const me = await provider.getMe();

    // `null` resolves to the current marking period, which lets the provider's
    // schedule cache serve me, courses and upcoming from one HAC page.
    const [courses, upcoming] = await Promise.all([
      provider.getCourses(parsed.data.mp ?? null),
      provider.getUpcomingAssignments(14),
    ]);

    return providerJson(session, {
      data: {
        me: me.data,
        courses: courses.data,
        upcoming: upcoming.data,
      },
      warnings: dedupeWarnings([
        ...me.warnings,
        ...courses.warnings,
        ...upcoming.warnings,
      ]),
      fetchedAt: courses.fetchedAt,
      cookies: upcoming.cookies ?? courses.cookies ?? me.cookies,
    });
  });
}
