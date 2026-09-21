import { useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { MainPage } from "./components/MainPage";
import { OnboardingPage } from "./components/OnboardingPage";

type SessionMode = "standard" | "guest";
type Screen = "onboarding" | "login" | "main";

export default function App() {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [sessionMode, setSessionMode] = useState<SessionMode>("standard");

  if (screen === "main") {
    return <MainPage sessionLabel={sessionMode === "guest" ? "Guest Session" : undefined} />;
  }

  if (screen === "login") {
    return (
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
    );
  }

  return <OnboardingPage onFinish={() => setScreen("login")} />;
}
