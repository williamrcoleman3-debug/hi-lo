// Client-side password policy -- UX only, same relationship to the server
// as USERNAME_PATTERN in UsernameField.jsx. The real gate is Supabase
// Auth's own minimum-password-length setting for this project; keep this
// at or below whatever that's configured to, so a password this accepts is
// never rejected server-side.
export const PASSWORD_MIN_LENGTH = 8;

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

export function passwordsMatch(password, confirmPassword) {
  return password === confirmPassword;
}
