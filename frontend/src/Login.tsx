import { useState, type FormEvent } from "react";
import "./Login.css";

export type UserRole = "Admin" | "Vendor";

// Which login page this is.
//   "Admin"  -> admin-only login
//   "Vendor" -> vendor-only login
//   "Any"    -> one login for both; credentials decide
export type LoginMode = UserRole | "Any";

type LoginProps = {
  mode: LoginMode;
  onLogin: (
    mode: LoginMode,
    username: string,
    password: string
  ) => void | Promise<void>;
  // Optional: the label of the first field ("Username" by default).
  usernameLabel?: string;
  // Optional: an error message to show above the button.
  error?: string;
  // Optional: true while the login request is running.
  submitting?: boolean;
};

export default function Login({
  mode,
  onLogin,
  usernameLabel = "Username",
  error = "",
  submitting = false,
}: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    onLogin(mode, username.trim(), password);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <img
          src="/Koc_logo.png"
          alt="King of Cards"
          className="login-logo"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

        <h1 className="login-title">King of Cards</h1>
        <p className="login-subtitle">
          {mode === "Vendor" ? "Vendor Portal" : "Cross-Selling CRM ⇄"}
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="username">{usernameLabel}</label>
          <input
            id="username"
            type="text"
            placeholder={`Enter ${usernameLabel.toLowerCase()}`}
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          <label htmlFor="password">Password</label>

          <div className="password-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? "Signing In…" : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}