import { Crosshair, Globe2, Sparkles } from "lucide-react";

const steps = [
  {
    number: "1",
    title: "Understand OrbiVue",
    description: "Discover what OrbiVue is and how it helps you understand Earth.",
    icon: Globe2
  },
  {
    number: "2",
    title: "Agentic Earth Intelligence",
    description: "See how our AI agent routes tasks and combines the right tools.",
    icon: Sparkles
  },
  {
    number: "3",
    title: "Signature Features",
    description: "Explore powerful features and experiences built for impact.",
    icon: Crosshair
  }
];

type OnboardingStepCardsProps = {
  activeStep: number;
};

export function OnboardingStepCards({ activeStep }: OnboardingStepCardsProps) {
  return (
    <section className="onboarding-step-panel relative rounded-[1.55rem] border border-onboarding-border bg-white/95 p-3 shadow-onboarding backdrop-blur-md sm:p-4">
      <div className="grid min-w-[920px] grid-cols-3 divide-x divide-[#b8b1a6] overflow-hidden lg:min-w-0">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = Number(step.number) === activeStep;
          return (
            <article key={step.number} className="grid grid-cols-[3.4rem_5rem_1fr] items-center gap-3 px-4 py-2">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold ${
                  isActive
                    ? "bg-onboarding-forest text-white shadow-[0_10px_24px_rgba(9,84,59,0.28)]"
                    : step.number === "1"
                      ? "bg-onboarding-greenSoft text-onboarding-forest"
                      : step.number === "2"
                        ? "bg-[#8b72a7] text-white"
                        : "bg-onboarding-orange text-white"
                }`}
              >
                {step.number}
              </span>
              <span
                className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full ${
                  step.number === "1"
                    ? "bg-onboarding-greenSoft text-onboarding-forest"
                    : step.number === "2"
                      ? "bg-[#eee4f4] text-[#66409a]"
                      : "bg-[#fae8d5] text-onboarding-orange"
                }`}
              >
                <Icon size={42} strokeWidth={1.7} />
              </span>
              <div>
                <h3 className="text-base font-extrabold text-onboarding-ink xl:text-lg">{step.title}</h3>
                <p className="mt-1.5 max-w-xs text-sm leading-5 text-onboarding-muted">{step.description}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div
        className={`absolute bottom-0 h-1.5 w-[24%] rounded-full bg-onboarding-forest transition-all duration-300 ${
          activeStep === 1 ? "left-6" : activeStep === 2 ? "left-[38%]" : "left-[70%]"
        }`}
      />
    </section>
  );
}
