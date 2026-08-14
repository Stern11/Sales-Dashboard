// Hardcoded rather than an env var — this isn't the kind of thing that
// varies between dev/preview/prod deployments of this app, and one fewer
// env var is one fewer thing to configure correctly in Vercel.
export const ALLOWED_EMAIL_DOMAIN = "heizen.work";

export function isAllowedEmail(email) {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
