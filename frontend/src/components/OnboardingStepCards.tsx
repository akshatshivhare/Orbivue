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
    <section className="onboarding-step-panel relative rounded-[1.2rem] border border-onboarding-border bg-white/95 p-2.5 shadow-onboarding backdrop-blur-md sm:p-3">
      <div className="grid min-w-[820px] grid-cols-3 divide-x divide-[#b8b1a6] overflow-hidden lg:min-w-0">
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = Number(step.number) === activeStep;
          return (
            <article key={step.number} className="grid grid-cols-[3rem_4.2rem_1fr] items-center gap-2.5 px-3 py-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-bold ${
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
                className={`flex h-[3.8rem] w-[3.8rem] items-center justify-center rounded-full ${
                  step.number === "1"
                    ? "bg-onboarding-greenSoft text-onboarding-forest"
                    : step.number === "2"
                      ? "bg-[#eee4f4] text-[#66409a]"
                      : "bg-[#fae8d5] text-onboarding-orange"
                }`}
              >
                <Icon size={34} strokeWidth={1.7} />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-onboarding-ink xl:text-base">{step.title}</h3>
                <p className="mt-1 max-w-xs text-xs leading-4 text-onboarding-muted">{step.description}</p>
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
