import { AuthFlow } from "./auth-flow";

// /auth — public route (proxy guard lets it through). Phone OTP sign-in.
// AuthFlow owns the full-screen gradient surface (matches design/login.html).
export default function AuthPage() {
  return <AuthFlow />;
}
