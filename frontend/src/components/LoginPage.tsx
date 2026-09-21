import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
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
import { splitLines, useLanguage } from "../i18n/LanguageContext";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../i18n/translations";
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
  const { language, setLanguage, t } = useLanguage();
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
          <select
            className="login-language-button"
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
            aria-label="Language selector"
          >
            {SUPPORTED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="login-shell">
        <div className="login-hero">
          <p className="login-kicker">{t("login.kicker")}</p>
          <h1>
            {splitLines(t("login.headline")).map((line, index) => (
              <span key={line}>
                {line}
                {index < splitLines(t("login.headline")).length - 1 && <br />}
              </span>
            ))}
          </h1>
          <p className="login-subtitle">{t("login.subtitle")}</p>

          <figure className="login-satellite-card">
            <img src={loginSatelliteImage} alt="Satellite imagery preview of Rio de Janeiro, Brazil" />
            <figcaption className="login-location-chip">
              <MapPin size={16} />
              {t("login.location")}
            </figcaption>
            <span className="login-analysis-box" aria-hidden="true" />
            <div className="login-evidence-card">
              <span>
                <Leaf size={22} />
              </span>
              <div>
                <strong>
                  {splitLines(t("login.evidenceTitle")).map((line, index) => (
                    <span key={line}>
                      {line}
                      {index < splitLines(t("login.evidenceTitle")).length - 1 && <br />}
                    </span>
                  ))}
                </strong>
                <p>
                  {t("login.evidenceLine1")}
                  <br />
                  {t("login.evidenceLine2")}
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
            <p>{t("login.imageFooter")}</p>
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
            <h2>{t("login.welcome")}</h2>
            <p>{t("login.signInSubtitle")}</p>
          </div>

          <label className="login-field">
            <span>{t("login.email")}</span>
            <div className="login-input-shell">
              <Mail size={20} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("login.emailPlaceholder")}
                autoComplete="email"
              />
            </div>
          </label>

          <label className="login-field">
            <span>{t("login.password")}</span>
            <div className="login-input-shell">
              <Lock size={20} />
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("login.passwordPlaceholder")}
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
              {t("login.rememberMe")}
            </label>
            <button type="button" className="login-text-button" title="Coming soon">
              {t("login.forgotPassword")}
            </button>
          </div>

          <button type="submit" disabled={!canSubmit} className="login-submit">
            {t("login.signIn")}
            <ArrowRight size={21} />
          </button>

          <button type="button" className="login-guest" onClick={onGuest}>
            {t("login.continueGuest")}
          </button>

          <div className="login-divider">
            <span />
            {t("login.or")}
            <span />
          </div>

          <button type="button" className="login-google" disabled title="Google sign-in coming soon">
            <span>G</span>
            {t("login.continueGoogle")}
            <em>{t("login.comingSoon")}</em>
          </button>

          <p className="login-create">
            {t("login.noAccount")}{" "}
            <button type="button" title="Coming soon">
              {t("login.createAccount")}
            </button>
          </p>

          <p className="login-demo-note">
            <ShieldCheck size={15} />
            {t("login.guestNote")}
          </p>
        </form>
      </section>

      <footer className="login-footer">
        <nav aria-label="Login support links">
          <span>{t("login.privacy")}</span>
          <span>{t("login.terms")}</span>
          <span>{t("login.help")}</span>
        </nav>
        <p>
          {t("login.footer")}
          <span />
        </p>
      </footer>
    </main>
  );
}
