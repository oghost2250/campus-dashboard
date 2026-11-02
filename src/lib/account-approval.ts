const AUTOMATIC_APPROVAL_DOMAIN = "@zewail.edu.eg";

export function isAutomaticallyApprovedEmail(
  email: string | null | undefined,
  provider: string | null | undefined,
  emailVerified: boolean | null | undefined,
) {
  return (
    provider === "google" &&
    emailVerified === true &&
    (email?.trim().toLowerCase() ?? "").endsWith(AUTOMATIC_APPROVAL_DOMAIN)
  );
}
