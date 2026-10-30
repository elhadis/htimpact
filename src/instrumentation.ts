export async function register() {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_LOGIN_ENABLED === "true") {
    console.error("DEMO_LOGIN_ENABLED is set, but demo sign-in stays disabled when NODE_ENV is production.");
  }
}
