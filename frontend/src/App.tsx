import { useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { MainPage } from "./components/MainPage";
import { OnboardingPage } from "./components/OnboardingPage";
import { LanguageProvider } from "./i18n/LanguageContext";

type SessionMode = "standard" | "guest";
type Screen = "onboarding" | "login" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [sessionMode, setSessionMode] = useState<SessionMode>("standard");

  if (screen === "main") {
    return (
      <LanguageProvider>
        <MainPage sessionMode={sessionMode} />
      </LanguageProvider>
    );
  }

  if (screen === "login") {
    return (
      <LanguageProvider>
        <LoginPage
          onLogin={() => {
            setSessionMode("standard");
            setScreen("main");
          }}
          onGuest={() => {
            setSessionMode("guest");
            setScreen("main");
          }}
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <OnboardingPage onFinish={() => setScreen("login")} />
    </LanguageProvider>
  );
}
