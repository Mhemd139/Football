import { AuthFlow } from "./auth-flow";

// /auth — public route (proxy guard lets it through). Phone OTP sign-in.
// Visual matches design/login.html: crest + headings live inside the card.
export default function AuthPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "#EEF2F6",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <AuthFlow />
      </div>
    </main>
  );
}
