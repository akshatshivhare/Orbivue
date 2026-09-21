import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Leaf,
  Lock,
  Mail,
  MapPin,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import loginSatelliteImage from "../assets/orbivue-login-satellite.png";
import { OrbivueLogo } from "./OrbivueLogo";

const THEME_STORAGE_KEY = "orbivue-theme";

type LoginPageProps = {
  onLogin?: () => void;
  onGuest?: () => void;
};

type LoginTheme = "light" | "dark";

function getInitialLoginTheme(): LoginTheme {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
}

export function LoginPage({ onLogin, onGuest }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [theme, setTheme] = useState<LoginTheme>(getInitialLoginTheme);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = isEmailValid && password.trim().length > 0;

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return (
    <main className="login-page" data-theme={theme}>
      <div className="login-contours" aria-hidden="true" />

      <header className="login-topbar">
        <OrbivueLogo className="login-brand-logo" />
        <p>Remote-sensing vision-language platform</p>
        <div className="login-top-actions">
          <button
            type="button"
            className="login-icon-button"
            onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" className="login-language-button" aria-label="Language selector">
            English
            <ChevronDown size={15} />
          </button>
        </div>
      </header>

      <section className="login-shell">
        <div className="login-hero">
          <p className="login-kicker">From space to real-world insights</p>
          <h1>
            A clearer
            <br />
            picture of
            <br />
            a brighter planet
          </h1>
          <p className="login-subtitle">
            Turn satellite imagery into trusted, actionable{" "}
            <br />
            intelligence with ORBIVUE.
          </p>

          <figure className="login-satellite-card">
            <img src={loginSatelliteImage} alt="Satellite imagery preview of Rio de Janeiro, Brazil" />
            <figcaption className="login-location-chip">
              <MapPin size={16} />
              Rio de Janeiro, Brazil
            </figcaption>
            <span className="login-analysis-box" aria-hidden="true" />
            <div className="login-evidence-card">
              <span>
                <Leaf size={22} />
              </span>
              <div>
                <strong>
                  Evidence-backed
                  <br />
                  Earth intelligence
                </strong>
                <p>
                  Monitor change. Validate with evidence.
                  <br />
                  Build a more resilient tomorrow.
                </p>
              </div>
            </div>
          </figure>

          <div className="login-image-footer">
            <div className="login-progress" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>
            <p>Satellite imagery&nbsp;&nbsp;•&nbsp;&nbsp;AI analysis&nbsp;&nbsp;•&nbsp;&nbsp;Real-world impact</p>
          </div>
        </div>

        <form
          className="login-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            onLogin?.();
          }}
        >
          <div className="login-card-brand">
            <OrbivueLogo className="login-card-logo" />
          </div>

          <div className="login-card-heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue your satellite analysis.</p>
          </div>

          <label className="login-field">
            <span>Email</span>
            <div className="login-input-shell">
              <Mail size={20} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-input-shell">
              <Lock size={20} />
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
              >
                {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="login-options">
            <label className="login-check">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span aria-hidden="true">
                <Check size={16} />
              </span>
              Remember me
            </label>
            <button type="button" className="login-text-button" title="Coming soon">
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={!canSubmit} className="login-submit">
            Sign in
            <ArrowRight size={21} />
          </button>

          <button type="button" className="login-guest" onClick={onGuest}>
            Continue as Guest
          </button>

          <div className="login-divider">
            <span />
            OR
            <span />
          </div>

          <button type="button" className="login-google" disabled title="Google sign-in coming soon">
            <span>G</span>
            Continue with Google
            <em>Coming Soon</em>
          </button>

          <p className="login-create">
            Don&apos;t have an account?{" "}
            <button type="button" title="Coming soon">
              Create account
            </button>
          </p>

          <p className="login-demo-note">
            <ShieldCheck size={15} />
            Guest mode opens the dashboard without creating an account.
          </p>
        </form>
      </section>

      <footer className="login-footer">
        <nav aria-label="Login support links">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Help &amp; Support</span>
        </nav>
        <p>
          A more resilient tomorrow
          <span />
        </p>
      </footer>
    </main>
  );
}
