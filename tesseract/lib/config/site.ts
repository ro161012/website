export const SITE = {
  name: "Tesseract",
  wordmark: "tesseract",
  tagline: "Every grade, in its place.",
  description:
    "Tesseract is an independent grade tracker for Home Access Center: current averages, assignment history, trends, what-if planning and attendance, without ads or analytics.",
  legalNotice:
    "Independent app. Not affiliated with or endorsed by PowerSchool or any school district. Home Access Center is a trademark of PowerSchool. Use only with your own account and follow your school's acceptable-use policy.",
} as const;

export type Site = typeof SITE;
