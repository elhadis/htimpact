/** Demo sign-in is a development convenience. Production never honors it. */
export function isDemoLoginEnabled() {
  return process.env.NODE_ENV === "development" && process.env.DEMO_LOGIN_ENABLED === "true";
}

export function assertDemoAllowed(isDemo: boolean) {
  if (!isDemo) return true;
  return isDemoLoginEnabled();
}
