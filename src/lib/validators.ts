const MOE_EMAIL_SUFFIX = "@moe-dl.edu.my";

export function isValidMoeEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(MOE_EMAIL_SUFFIX);
}

export function getMoeEmailError(email: string): string | null {
  if (!isValidMoeEmail(email)) {
    return "Only MOE school emails are allowed.";
  }
  return null;
}
