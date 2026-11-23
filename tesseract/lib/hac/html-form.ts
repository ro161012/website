import * as cheerio from "cheerio";

export interface FormSubmission {
  action: URL;
  method: "GET" | "POST";
  fields: Record<string, string>;
}

export interface ExtractFormOptions {
  pageUrl: URL;
  formSelector?: string;
  fieldOverrides?: Record<string, string>;
  submitSelector?: string;
  includePasswords?: boolean;
  includeButtons?: boolean;
  /** Safety default: do not silently target an unrelated form. */
  fallbackToFirstForm?: boolean;
}

function looksLikePassword(name: string): boolean {
  return /pass(word)?|pwd/i.test(name);
}

function looksLikeUsername(name: string): boolean {
  return /user(name)?/i.test(name);
}

/**
 * Extract a form's current values so ASP.NET controls can be replayed. The
 * caller decides which identity fields to substitute; by default passwords are
 * excluded so they cannot leak through a stray hidden field.
 */
export function extractForm(
  html: string,
  options: ExtractFormOptions,
): FormSubmission | null {
  const $ = cheerio.load(html);
  const formSelector = options.formSelector ?? "form";
  let $form = $(formSelector).first();
  if ($form.length === 0 && options.fallbackToFirstForm !== false) {
    $form = $("form").first();
  }
  if ($form.length === 0) return null;

  const actionRaw = ($form.attr("action") ?? "").trim();
  let action: URL;
  try {
    action = new URL(actionRaw || options.pageUrl.toString(), options.pageUrl);
  } catch {
    action = new URL(options.pageUrl.toString());
  }

  const method = ($form.attr("method") ?? "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const fields: Record<string, string> = {};

  $form.find("input").each((_index, element) => {
    const $input = $(element);
    const name = ($input.attr("name") ?? "").trim();
    if (!name) return;

    const type = ($input.attr("type") ?? "text").toLowerCase();
    if (["submit", "button", "image", "reset", "file"].includes(type)) return;
    if (type === "password" && !options.includePasswords) return;
    if (
      (type === "checkbox" || type === "radio") &&
      $input.attr("checked") === undefined
    ) {
      return;
    }

    const value = $input.attr("value") ?? (type === "checkbox" || type === "radio" ? "on" : "");
    fields[name] = value;
  });

  $form.find("select").each((_index, element) => {
    const $select = $(element);
    const name = ($select.attr("name") ?? "").trim();
    if (!name) return;

    const optionsList = $select.find("option").toArray();
    if (optionsList.length === 0) return;

    const selected = optionsList.filter(
      (option) => $(option).attr("selected") !== undefined,
    );
    const chosen = selected.length > 0 ? selected : [optionsList[0]!];
    const values = chosen.map((option) => $(option).attr("value") ?? $(option).text().trim());

    if ($select.attr("multiple") !== undefined) {
      if (values.length > 0) fields[name] = values.join(",");
    } else if (values[0] !== undefined) {
      fields[name] = values[0];
    }
  });

  $form.find("textarea").each((_index, element) => {
    const $textarea = $(element);
    const name = ($textarea.attr("name") ?? "").trim();
    if (!name) return;
    fields[name] = $textarea.text();
  });

  if (options.includeButtons !== false) {
    const selector = options.submitSelector ?? 'input[type="submit"], button[type="submit"], button:not([type])';
    const $submit = $form.find(selector).first();
    if ($submit.length > 0) {
      const name = ($submit.attr("name") ?? "").trim();
      if (name) fields[name] = $submit.attr("value") ?? $submit.text().trim();
    }
  }

  for (const [key, value] of Object.entries(options.fieldOverrides ?? {})) {
    fields[key] = value;
  }

  return { action, method, fields };
}

/** Remove caller-supplied identity fields before setting trusted overrides. */
export function clearCredentialFields(
  fields: Record<string, string>,
  extraNames: string[] = [],
): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (looksLikePassword(key) || looksLikeUsername(key)) continue;
    if (extraNames.includes(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}
