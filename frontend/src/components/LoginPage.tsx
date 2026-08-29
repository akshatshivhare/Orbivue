import {
  BarChart3,
  Brain,
  Eye,
  Leaf,
  Lock,
  Mail,
  Satellite,
  ShieldCheck
} from "lucide-react";
import { OrbivueLogo } from "./OrbivueLogo";

const insightCards = [
  {
    title: "Satellite Data",
    description: "Real-time earth observation",
    icon: Satellite,
    className: "left-[34%] top-[14%]",
    iconClass: "bg-onboarding-greenSoft text-onboarding-forest"
  },
  {
    title: "AI Agent",
    description: "Intelligent insights at your command",
    icon: Brain,
    className: "left-[10%] top-[47%]",
    iconClass: "bg-[#eee4f4] text-[#644397]"
  },
  {
    title: "Analysis Engine",
    description: "Advanced analytics for impact",
    icon: BarChart3,
    className: "right-[30%] bottom-[15%]",
    iconClass: "bg-[#e8f1fb] text-[#2d72bc]"
  }
];

type LoginPageProps = {
  onLogin?: () => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <main className="login-page fixed inset-0 overflow-hidden bg-[#0d3440] p-0 text-onboarding-ink">
      <div className="relative h-full w-full overflow-hidden bg-[#0d3440] lg:rounded-[2rem]">
        <img
          src="/assets/login-earth-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,46,54,0.08)_0%,rgba(8,46,54,0.12)_44%,rgba(8,46,54,0.5)_100%)]" />

        <section className="relative z-10 grid h-full grid-cols-1 gap-6 p-4 lg:grid-cols-[1fr_minmax(500px,0.74fr)] lg:p-8">
          <div className="relative hidden min-h-0 lg:block">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 820" fill="none" aria-hidden="true">
              <path d="M268 235 C225 300 181 330 156 410" stroke="rgba(255,255,255,0.78)" strokeWidth="2" strokeDasharray="7 9" />
              <path d="M304 520 C378 512 445 560 480 640" stroke="rgba(255,255,255,0.72)" strokeWidth="2" strokeDasharray="7 9" />
              <path d="M170 410 C238 455 315 500 304 520" stroke="rgba(255,255,255,0.58)" strokeWidth="2" strokeDasharray="7 9" />
              <circle cx="268" cy="235" r="9" fill="rgba(74,161,105,0.84)" stroke="rgba(255,255,255,0.85)" strokeWidth="4" />
              <circle cx="304" cy="520" r="9" fill="rgba(139,114,167,0.84)" stroke="rgba(255,255,255,0.85)" strokeWidth="4" />
              <circle cx="480" cy="640" r="9" fill="rgba(45,114,188,0.88)" stroke="rgba(255,255,255,0.85)" strokeWidth="4" />
            </svg>

            {insightCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className={`login-insight-card absolute flex w-[235px] items-center gap-4 rounded-2xl border border-white/80 p-4 shadow-onboarding backdrop-blur-md ${card.className}`}
                >
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${card.iconClass}`}>
                    <Icon size={28} strokeWidth={1.8} />
                  </span>
                  <span>
                    <strong className="block text-base font-extrabold text-onboarding-ink">{card.title}</strong>
                    <span className="mt-1 block text-sm leading-5 text-onboarding-muted">{card.description}</span>
                  </span>
                </article>
              );
            })}

            <div className="absolute bottom-3 left-6 flex items-center gap-4 rounded-2xl border border-white/20 bg-[#183f3d]/75 px-6 py-4 text-sm font-semibold text-white shadow-onboarding backdrop-blur-md">
              <Leaf size={25} className="text-[#abd6aa]" />
              Powered by nature. Driven by intelligence.
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onLogin?.();
            }}
            className="login-card ml-auto flex h-full max-h-[calc(100svh-5rem)] w-full max-w-[650px] flex-col justify-center rounded-[1.7rem] border border-white/90 bg-white/98 px-8 py-7 shadow-[0_28px_80px_rgba(5,24,28,0.36)] backdrop-blur-xl sm:px-12 lg:px-14"
          >
            <OrbivueLogo className="login-logo w-[235px]" />

            <div className="login-heading mt-8">
              <h1 className="text-4xl font-extrabold leading-tight tracking-normal text-[#193340] sm:text-[2.35rem]">
                Welcome back, <span className="text-[#2f8b58]">Explorer.</span>
              </h1>
              <p className="mt-2 text-base text-onboarding-muted">
                Sign in to continue your journey of understanding Earth.
              </p>
            </div>

            <label className="mt-6 block">
              <span className="text-sm font-bold text-[#2f3f52]">Email address</span>
              <span className="mt-2.5 flex h-[3.25rem] items-center gap-4 rounded-xl border border-[#d8d8d4] bg-white px-4 text-onboarding-muted shadow-sm">
                <Mail size={22} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full border-0 bg-transparent text-base text-onboarding-ink outline-none placeholder:text-onboarding-muted"
                />
              </span>
            </label>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-[#2f3f52]">Password</span>
              <span className="mt-2.5 flex h-[3.25rem] items-center gap-4 rounded-xl border border-[#d8d8d4] bg-white px-4 text-onboarding-muted shadow-sm">
                <Lock size={22} />
                <input
                  type="password"
                  placeholder="password"
                  className="w-full border-0 bg-transparent text-base text-onboarding-ink outline-none placeholder:text-onboarding-muted"
                />
                <Eye size={21} />
              </span>
            </label>

            <button type="button" className="ml-auto mt-2.5 text-sm font-semibold text-[#2f8b58]">
              Forgot password?
            </button>

            <button
              type="submit"
              className="mt-6 flex h-[3.25rem] items-center justify-center gap-3 rounded-xl bg-[#2f8b58] text-base font-extrabold text-white shadow-[0_14px_30px_rgba(47,139,88,0.28)] transition hover:bg-onboarding-forest"
            >
              <Leaf size={22} />
              Enter OrbiVue
            </button>

            <div className="my-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-sm text-onboarding-muted">
              <span className="h-px bg-[#deded8]" />
              or
              <span className="h-px bg-[#deded8]" />
            </div>

            <button
              type="button"
              className="flex h-[3.25rem] items-center justify-center gap-3 rounded-xl border border-[#d8d8d4] bg-white text-base font-extrabold text-[#2f3f52] shadow-sm"
            >
              <span className="text-2xl font-black text-[#4285f4]">G</span>
              Continue with Google
            </button>

            <div className="mt-6 flex items-center gap-4 text-sm text-onboarding-muted">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-onboarding-greenSoft text-onboarding-forest">
                <ShieldCheck size={22} />
              </span>
              <span>
                <strong className="block font-semibold text-onboarding-muted">Your data is secure and encrypted</strong>
                <span>We use industry-standard encryption to protect your information.</span>
              </span>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
