const MOE_EMAIL_SUFFIX = "@moe-dl.edu.my";
const ADMIN_EMAILS = [
  "admin@teenager.my",
  "haojiao0803@gmail.com"
] as const;

export function isAdminEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  return ADMIN_EMAILS.includes(normalizedEmail as (typeof ADMIN_EMAILS)[number]);
}

export function isValidMoeEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(MOE_EMAIL_SUFFIX);
}

export function getMoeEmailError(email: string): string | null {
  if (!isValidMoeEmail(email) && !isAdminEmail(email)) {
    return "Only MOE school emails are allowed.";
  }
  return null;
}
