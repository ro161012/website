import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type {
  HacDistrictDirectory,
  HacDistrictOption,
} from "@/lib/config/hac-networks";

const DISTRICT_FIELD = /^(database|district|districtid|sitecode|sitedistrict)$/i;
const DISTRICT_HINT = /district|database|sitecode/i;
const IGNORED_OPTION = /^(select|choose|none|all)\b/i;
const NON_DISTRICT_OPTION =
  /(current|previous)\s+school\s+year|^\d{2}[_-]\d{2}$|training|test\s+district/i;

function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function optionText($: cheerio.CheerioAPI, element: AnyNode): string {
  return clean($(element).text());
}

/**
 * Read the district selector from a HAC login page. Returns null when the
 * page does not expose a multi-district picker.
 */
export function parseDistrictDirectory(html: string): HacDistrictDirectory | null {
  const $ = cheerio.load(html);
  const $password = $('input[type="password"]').first();
  const $form = $password.length > 0 ? $password.closest("form") : $();

  const candidates: Array<HacDistrictDirectory & { score: number }> = [];

  $form.find("select").each((_index, element) => {
    const $select = $(element);
    const field = clean($select.attr("name")) || clean($select.attr("id"));
    if (!field) return;

    const hint = `${field} ${$select.attr("id") ?? ""}`;
    if (!DISTRICT_HINT.test(hint)) return;

    const options: HacDistrictOption[] = [];
    const seen = new Set<string>();

    $select.find("option").each((_optionIndex, option) => {
      const value = clean($(option).attr("value"));
      const name = optionText($, option);
      if (!value || !name || name.length > 120) return;
      if (IGNORED_OPTION.test(name) || NON_DISTRICT_OPTION.test(name)) return;
      if (seen.has(value)) return;
      seen.add(value);
      options.push({ id: value, name });
    });

    if (options.length < 2) return;

    let score = 0;
    if (DISTRICT_FIELD.test(field)) score += 10;
    if (/district/i.test(hint)) score += 8;
    if (/sitecode/i.test(hint)) score += 5;
    if (options.length >= 5) score += 2;
    if (score === 0) return;

    const selected = clean(
      $select.find("option[selected]").first().attr("value"),
    );

    candidates.push({
      field,
      options: options.slice(0, 1_000),
      selectedId:
        selected && options.some((option) => option.id === selected)
          ? selected
          : null,
      score,
    });
  });

  candidates.sort(
    (left, right) =>
      right.score - left.score || right.options.length - left.options.length,
  );
  const best = candidates[0];
  if (!best) return null;

  return {
    field: best.field,
    options: best.options,
    selectedId: best.selectedId,
  };
}
