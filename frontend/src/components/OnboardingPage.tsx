import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  ChartNoAxesCombined,
  Check,
  Clock3,
  Globe2,
  GitBranch,
  Mic,
  Radio,
  Satellite,
  ShieldCheck,
  Zap
} from "lucide-react";
import { OnboardingStepCards } from "./OnboardingStepCards";
import { OrbivueLogo } from "./OrbivueLogo";

const featureCards = [
  {
    title: "Understands Query",
    description: "Interprets intent and context",
    icon: Brain,
    className: "left-[4%] top-[10%]",
    iconClass: "bg-onboarding-greenSoft text-onboarding-forest"
  },
  {
    title: "Selects Models",
    description: "Chooses the best AI models for your question",
    icon: GitBranch,
    className: "right-[8%] top-[26%]",
    iconClass: "bg-[#eee4f4] text-[#644397]"
  },
  {
    title: "Optical + SAR",
    description: "Combines optical, SAR, and temporal data",
    icon: Radio,
    className: "left-[10%] top-[43%]",
    iconClass: "bg-[#e6e6f5] text-[#3653aa]"
  },
  {
    title: "Change Analysis",
    description: "Detects change and extracts patterns",
    icon: ChartNoAxesCombined,
    className: "right-[5%] top-[61%]",
    iconClass: "bg-[#fae8d5] text-onboarding-orange"
  },
  {
    title: "Evidence Chain",
    description: "Builds verifiable, cited insights you can trust",
    icon: ShieldCheck,
    className: "right-[17%] bottom-[8%]",
    iconClass: "bg-onboarding-greenSoft text-onboarding-forest"
  }
];

const finalFeatureCards = [
  {
    title: "Time Comparison",
    description: "Analyze changes across time instantly.",
    icon: Clock3,
    className: "left-[1%] top-[12%]",
    iconClass: "bg-onboarding-greenSoft text-onboarding-forest"
  },
  {
    title: "Disaster Replay",
    description: "Revisit events and understand impact.",
    icon: Zap,
    className: "right-[5%] top-[20%]",
    iconClass: "bg-[#fae8d5] text-onboarding-orange"
  },
  {
    title: "Satellite Detective",
    description: "AI-powered anomaly detection at scale.",
    icon: Satellite,
    className: "left-[-4%] top-[40%]",
    iconClass: "bg-[#eee4f4] text-[#644397]"
  },
  {
    title: "Voice Input",
    description: "Ask questions. Get instant insights.",
    icon: Mic,
    className: "right-[3%] top-[47%]",
    iconClass: "bg-onboarding-greenSoft text-onboarding-forest"
  },
  {
    title: "Multilingual",
    description: "Ask in your language. Get answers instantly.",
    icon: Globe2,
    className: "left-[-5%] bottom-[17%]",
    iconClass: "bg-[#fae8d5] text-onboarding-orange"
  },
  {
    title: "Evidence Snapshot",
    description: "Capture, compile, and share with confidence.",
    icon: ShieldCheck,
    className: "right-[8%] bottom-[10%]",
    iconClass: "bg-[#eee4f4] text-[#644397]"
  }
];

const signatureFeatures = [
  "Time Comparison",
  "Disaster Replay",
  "Satellite Detective",
  "Voice Assistance",
  "Multilingual Support",
  "Compare Sensors",
  "Evidence Chain"
];

type OnboardingPageProps = {
  onFinish?: () => void;
};

export function OnboardingPage({ onFinish }: OnboardingPageProps) {
  const [currentSlide, setCurrentSlide] = useState(1);
  const isIntroSlide = currentSlide === 2;
  const isFinalSlide = currentSlide === 3;
  const caption = isFinalSlide
    ? "You're all set. Let's explore Earth."
    : isIntroSlide
      ? "Powering your exploration"
      : "Let's get you oriented";

  const goNext = () => {
    if (currentSlide === 3) {
      onFinish?.();
      return;
    }

    setCurrentSlide((slide) => Math.min(slide + 1, 3));
  };

  const goBack = () => {
    setCurrentSlide((slide) => Math.max(slide - 1, 1));
  };

  return (
    <main
      className={`onboarding-page relative h-screen overflow-hidden bg-onboarding-cream text-onboarding-ink ${
        isFinalSlide ? "onboarding-final-slide" : ""
      }`}
    >
      <img
        src="/assets/onboarding-earth-bg.png"
        alt=""
        className="onboarding-bg absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />
      <div className="onboarding-tint absolute inset-0 bg-[linear-gradient(90deg,rgba(250,244,232,0.99)_0%,rgba(250,244,232,0.96)_29%,rgba(250,244,232,0.48)_55%,rgba(250,244,232,0.04)_100%)]" />
      <div className="onboarding-rings absolute inset-0 opacity-55 [background-image:radial-gradient(circle_at_70%_46%,transparent_0,transparent_54px,rgba(255,255,255,0.58)_55px,transparent_57px),radial-gradient(circle_at_70%_46%,transparent_0,transparent_125px,rgba(255,255,255,0.34)_126px,transparent_128px)]" />
      <div className="onboarding-moon absolute right-[7%] top-[11%] h-28 w-28 rounded-full border border-white/40 opacity-70" />
      <div className="onboarding-spark onboarding-spark-a absolute right-[13%] top-[52%] hidden h-2 w-2 rounded-full bg-white shadow-[0_0_24px_8px_rgba(255,255,255,0.8)] lg:block" />
      <div className="onboarding-spark onboarding-spark-b absolute right-[35%] top-[26%] hidden h-2 w-2 rounded-full bg-white shadow-[0_0_24px_8px_rgba(255,255,255,0.8)] lg:block" />

      <section className="onboarding-shell relative z-10 flex h-screen flex-col px-5 py-4 sm:px-8 lg:px-[4rem]">
        <div className="onboarding-main grid flex-1 gap-4 lg:grid-cols-[minmax(620px,0.9fr)_minmax(500px,1fr)]">
          <div className="onboarding-copy flex min-h-0 flex-col">
          <OrbivueLogo className="onboarding-logo pt-3" />

          <div className="onboarding-divider mt-10 flex items-center gap-3 lg:mt-[2.2rem]">
            <span className="h-px w-16 bg-onboarding-orange" />
            <span className="h-2.5 w-2.5 rounded-full bg-onboarding-orange" />
          </div>

          <div className="onboarding-hero-text mt-5 max-w-[760px]">
            <h1 className="onboarding-headline font-serif font-semibold italic tracking-normal text-onboarding-forest">
              {isFinalSlide ? (
                <>
                  <span className="not-italic">Explore powerful</span>
                  <br />
                  <span className="not-italic">Earth workflows.</span>
                  <br />
                  <span className="text-onboarding-orange">From change to evidence.</span>
                </>
              ) : isIntroSlide ? (
                <>
                  <span className="not-italic">Ask Earth.</span>
                  <br />
                  <span className="not-italic">See What Changed</span>
                  <span className="text-onboarding-orange">.</span>
                </>
              ) : (
                <>
                  <span className="not-italic">One question.</span>
                  <br />
                  <span className="not-italic">Many expert tools.</span>
                  <br />
                  One <span className="text-onboarding-orange">clear answer.</span>
                </>
              )}
            </h1>
            <p className="onboarding-body mt-4 max-w-[660px] text-onboarding-ink">
              {isFinalSlide ? (
                <>
                  OrbiVue&apos;s signature features help you explore, analyze, and prove what
                  matters, from Time Comparison to Evidence Chain. Built for{" "}
                  <strong className="font-extrabold text-onboarding-forest">clarity</strong>,{" "}
                  <strong className="font-extrabold text-onboarding-forest">speed</strong>, and{" "}
                  <strong className="font-extrabold text-onboarding-forest">impact</strong>.
                </>
              ) : isIntroSlide ? (
                <>
                  OrbiVue is your{" "}
                  <strong className="font-extrabold text-onboarding-forest">AI-powered</strong>{" "}
                  Earth intelligence platform. Ask natural-language questions. We analyze{" "}
                  <strong className="font-extrabold text-onboarding-forest">multi-sensor</strong>{" "}
                  data across time to deliver{" "}
                  <strong className="font-extrabold text-onboarding-orange">evidence-backed insights</strong>{" "}
                  you can trust.
                </>
              ) : (
                <>
                  OrbiVue&apos;s agentic AI{" "}
                  <strong className="font-extrabold text-onboarding-forest">understands</strong>{" "}
                  your question,{" "}
                  <strong className="font-extrabold text-[#7b63a4]">selects</strong>{" "}
                  the right models, and{" "}
                  <strong className="font-extrabold text-onboarding-orange">orchestrates</strong>{" "}
                  a suite of specialized tools, combining{" "}
                  <strong className="font-extrabold text-onboarding-forest">optical</strong>, SAR, and{" "}
                  <strong className="font-extrabold text-onboarding-orange">temporal</strong>{" "}
                  data with{" "}
                  <strong className="font-extrabold text-onboarding-forest">evidence-based</strong>{" "}
                  workflows to deliver trustworthy insights you can rely on.
                </>
              )}
            </p>
            {isFinalSlide && (
              <div className="onboarding-feature-list mt-4 grid max-w-[600px] grid-cols-2 gap-x-8 gap-y-1.5 text-[0.92rem] text-onboarding-ink">
                {signatureFeatures.map((feature) => (
                  <span key={feature} className="flex items-center gap-3">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-onboarding-forest text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {feature}
                  </span>
                ))}
              </div>
            )}
            </div>

          <div className="onboarding-actions mt-auto flex w-full max-w-[600px] flex-col items-start gap-4 pt-5">
            {isFinalSlide ? (
              <button
                onClick={goBack}
                className="flex items-center gap-2 border-b-2 border-onboarding-forest pb-1.5 text-base font-extrabold text-onboarding-ink"
              >
                <ArrowLeft size={21} />
                Back
              </button>
            ) : (
              <button className="flex items-center gap-2 border-b-2 border-onboarding-forest pb-1.5 text-base font-extrabold text-onboarding-ink">
                See how it works
                <ArrowRight size={21} />
              </button>
            )}
            <button
              onClick={goNext}
              className="group flex h-12 min-w-[168px] items-center justify-center gap-3 rounded-xl bg-onboarding-forest px-3.5 text-[0.94rem] font-extrabold text-white shadow-[0_14px_30px_rgba(10,74,56,0.24)] transition hover:bg-[#123f35]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/75 transition group-hover:translate-x-1">
                <ArrowRight size={21} />
              </span>
              {isFinalSlide ? "Start Exploring" : isIntroSlide ? "Enter OrbiVue" : "Continue"}
            </button>
          </div>

          <div className="onboarding-progress mt-5 flex flex-wrap items-center gap-6 text-onboarding-muted">
            <div className="flex items-center gap-2 text-lg font-semibold text-onboarding-ink">
              <span>{currentSlide}</span>
              <span className="text-onboarding-muted">/</span>
              <span className="text-onboarding-muted">3</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${currentSlide === 1 ? "bg-onboarding-forest" : "bg-onboarding-muted/35"}`} />
              <span className={`h-2.5 w-2.5 rounded-full ${currentSlide === 2 ? "bg-onboarding-forest" : "bg-onboarding-muted/35"}`} />
              <span className={`h-2.5 w-2.5 rounded-full ${currentSlide === 3 ? "bg-onboarding-forest" : "bg-onboarding-muted/35"}`} />
            </div>
            <span className="text-sm">{caption}</span>
          </div>
          </div>

          <div className="onboarding-feature-area relative hidden min-h-[500px] lg:block">
            {isFinalSlide ? (
              <>
                <svg
                  className="onboarding-feature-lines absolute inset-0 h-full w-full"
                  viewBox="0 0 620 560"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M154 170 C240 158 292 206 355 205 C420 204 462 165 536 176" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeDasharray="7 8" />
                  <path d="M120 330 C210 310 255 360 308 392 C357 422 420 421 487 385" stroke="rgba(255,255,255,0.68)" strokeWidth="2" strokeDasharray="7 8" />
                  <path d="M405 420 C400 480 358 513 306 507 C253 501 230 455 245 410" stroke="rgba(255,255,255,0.56)" strokeWidth="2" strokeDasharray="7 8" />
                  <circle cx="154" cy="170" r="4" fill="white" />
                  <circle cx="355" cy="205" r="4" fill="white" />
                  <circle cx="536" cy="176" r="4" fill="white" />
                  <circle cx="308" cy="392" r="4" fill="white" />
                  <circle cx="487" cy="385" r="4" fill="white" />
                </svg>
                <div className="onboarding-earth-details absolute inset-0">
                  <span className="absolute left-[18%] top-[5%] font-mono text-xs font-semibold tracking-[0.18em] text-white/80">
                    + 24.5937 N
                  </span>
                  <span className="absolute right-[3%] top-[36%] font-mono text-xs font-semibold tracking-[0.18em] text-white/90">
                    89.4126 E +
                  </span>
                  <span className="absolute right-[1%] top-[2%] h-28 w-28 rounded-full border border-dashed border-white/45" />
                  <span className="absolute bottom-[2%] left-[45%] h-28 w-28 rounded-full border border-white/45" />
                  <span className="absolute bottom-[7%] left-[49%] h-8 w-8 rounded-full border border-white/75" />
                  <span className="absolute bottom-[9.3%] left-[51.5%] h-3 w-3 rounded-full bg-white" />
                </div>
                {finalFeatureCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <article
                      key={card.title}
                    className={`onboarding-feature-card absolute z-10 flex w-[210px] items-center gap-2.5 rounded-[1rem] border border-white/85 bg-white/95 p-2.5 shadow-onboarding backdrop-blur-md xl:w-[235px] ${card.className}`}
                  >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${card.iconClass}`}>
                        <Icon size={22} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm font-extrabold text-onboarding-ink">{card.title}</strong>
                        <span className="mt-0.5 block text-[0.68rem] leading-4 text-onboarding-muted">{card.description}</span>
                      </span>
                      <ArrowRight className="ml-auto shrink-0 text-onboarding-ink" size={16} />
                    </article>
                  );
                })}
              </>
            ) : isIntroSlide ? (
              <div className="onboarding-earth-details absolute inset-0">
                <span className="absolute left-[5%] top-[8%] font-mono text-sm font-semibold tracking-[0.18em] text-white/85">
                  + 24.5937 N
                </span>
                <span className="absolute right-[5%] top-[45%] font-mono text-sm font-semibold tracking-[0.18em] text-white/90">
                  89.4126 E +
                </span>
                <span className="absolute right-[5%] top-[12%] h-24 w-24 rounded-full border border-white/45" />
                <span className="absolute bottom-[12%] left-[48%] h-28 w-28 rounded-full border border-white/50" />
                <span className="absolute bottom-[16%] left-[52%] h-12 w-12 rounded-full border border-white/70" />
                <span className="absolute bottom-[19%] left-[55%] h-3 w-3 rounded-full bg-white" />
                <span className="absolute bottom-[16%] left-[45%] h-36 w-36 rounded-full border border-dashed border-white/55" />
              </div>
            ) : (
              <>
            <svg
              className="onboarding-feature-lines absolute inset-0 h-full w-full"
              viewBox="0 0 620 560"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M142 104 C218 116 231 205 274 234 C319 265 389 230 439 255"
                stroke="rgba(255,255,255,0.78)"
                strokeWidth="2"
                strokeDasharray="7 8"
              />
              <path
                d="M210 256 C272 286 298 344 370 362 C424 375 474 358 515 394"
                stroke="rgba(255,255,255,0.72)"
                strokeWidth="2"
                strokeDasharray="7 8"
              />
              <path
                d="M404 403 C356 441 310 462 251 451 C214 444 187 421 164 389"
                stroke="rgba(255,255,255,0.62)"
                strokeWidth="2"
                strokeDasharray="7 8"
              />
              <circle cx="274" cy="234" r="4" fill="white" />
              <circle cx="439" cy="255" r="4" fill="white" />
              <circle cx="370" cy="362" r="4" fill="white" />
              <circle cx="515" cy="394" r="4" fill="white" />
              <circle cx="251" cy="451" r="4" fill="white" />
            </svg>
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  className={`onboarding-feature-card absolute z-10 flex w-[225px] items-center gap-2.5 rounded-[1rem] border border-white/85 bg-white/95 p-2.5 shadow-onboarding backdrop-blur-md xl:w-[255px] ${card.className}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full xl:h-12 xl:w-12 ${card.iconClass}`}>
                    <Icon size={24} strokeWidth={1.9} />
                  </span>
                  <span>
                    <strong className="block text-[0.82rem] font-extrabold text-onboarding-ink xl:text-sm">{card.title}</strong>
                    <span className="mt-0.5 block text-[0.7rem] leading-4 text-onboarding-muted xl:text-xs">{card.description}</span>
                  </span>
                </article>
              );
            })}
              </>
            )}
          </div>
        </div>

        <div className="onboarding-steps-wrap mt-4 overflow-x-auto pb-1">
          <OnboardingStepCards activeStep={currentSlide} />
        </div>
        {isFinalSlide && (
          <div className="onboarding-trust-row flex items-center justify-center gap-5 pt-3 text-sm text-onboarding-ink">
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-onboarding-forest" />
              Trusted data
            </span>
            <span className="h-1 w-1 rounded-full bg-onboarding-forest" />
            <span>Clear evidence</span>
            <span className="h-1 w-1 rounded-full bg-onboarding-forest" />
            <span>Human-friendly AI</span>
          </div>
        )}
      </section>
    </main>
  );
}
