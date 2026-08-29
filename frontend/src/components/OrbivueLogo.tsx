interface OrbivueLogoProps {
  className?: string;
}

export function OrbivueLogo({ className = "" }: OrbivueLogoProps) {
  return (
    <img
      src="/assets/orbivue-logo.png"
      alt="Orbivue"
      className={`h-auto w-[280px] max-w-[72vw] object-contain sm:w-[330px] ${className}`}
    />
  );
}
