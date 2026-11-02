import { useState } from "react";
import { api } from "../services/api";
import { Loader2, LockKeyhole } from "lucide-react";
export function Login({
  error,
  onAuthenticated,
  googleConfigured = true,
}: {
  error: string;
  onAuthenticated?: () => Promise<void>;
  googleConfigured?: boolean;
}) {
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState(""),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState("");
  return (
    <main className="login">
      <section className="auth-main">
        <div className="login-content">
          <h1>{register ? "Sign up" : "Login"}</h1>
          <a className="google-signin" href="/auth/google">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.6 12.2c0-.7-.1-1.4-.2-2.2H12v4.2h5.4a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.7Z"
              />
              <path
                fill="#34A853"
                d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.9-1.8-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z"
              />
              <path
                fill="#FBBC05"
                d="M6.3 13.7a6 6 0 0 1 0-3.4V7.6H2.9a10 10 0 0 0 0 8.8l3.4-2.7Z"
              />
              <path
                fill="#EA4335"
                d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9.1 5.6l3.4 2.7A6 6 0 0 1 12 6.1Z"
              />
            </svg>
            Login with Google
          </a>
          <div className="auth-divider">
            <span />
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setLocalError("");
              }}
            >
              {register
                ? "or log in through email"
                : "or sign up through email"}
            </button>
            <span />
          </div>
          <form
            className="password-login"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setLocalError("");
              try {
                await api(register ? "/auth/register" : "/auth/login", {
                  method: "POST",
                  body: JSON.stringify({
                    email,
                    password,
                    ...(register ? { firstName, lastName } : {}),
                  }),
                });
                await onAuthenticated?.();
              } catch (error) {
                setLocalError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {register && (
              <div className="signup-name-fields">
                <input
                  aria-label="First name"
                  autoComplete="given-name"
                  placeholder="First name"
                  required
                  maxLength={60}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={busy}
                />
                <input
                  aria-label="Last name"
                  autoComplete="family-name"
                  placeholder="Last name"
                  required
                  maxLength={60}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={busy}
                />
              </div>
            )}
            <input
              type="email"
              aria-label="Email ID"
              placeholder="Email ID"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
            <input
              type="password"
              aria-label="Password"
              placeholder={register ? "Password (12+ characters)" : "Password"}
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 12 : 1}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <button className="login-submit" disabled={busy}>
              {busy ? (
                <Loader2 size={18} className="spin" />
              ) : register ? (
                "Sign up"
              ) : (
                "Login"
              )}
            </button>
          </form>
          {localError && (
            <div role="alert" className="login-error">
              {localError}
            </div>
          )}
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          {!googleConfigured && (
            <div className="auth-config-note">
              <LockKeyhole size={16} />
              <span>
                Google sign-in needs to be configured for this installation.
              </span>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
