import { useState } from "react";
import { LoginPage } from "./components/LoginPage";
import { MainPage } from "./components/MainPage";
import { OnboardingPage } from "./components/OnboardingPage";

export default function App() {
  const [screen, setScreen] = useState<"onboarding" | "login" | "main">("onboarding");

  if (screen === "main") {
    return <MainPage />;
  }

  if (screen === "login") {
    return <LoginPage onLogin={() => setScreen("main")} />;
  }

  return <OnboardingPage onFinish={() => setScreen("login")} />;
}
