export function StatusBar() {
  return (
    <footer className="main-footer relative z-20 grid min-h-[3.4rem] grid-cols-1 items-center gap-2 bg-[#005742] px-5 py-3 text-sm text-white/85 md:grid-cols-2 md:px-8 md:py-0">
      <div className="flex items-center gap-3">
        <span>ORBIVUE Earth intelligence workspace</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 md:justify-end">
        <span>Privacy</span>
        <span>Terms</span>
        <span>Feedback</span>
      </div>
    </footer>
  );
}
