import { ChevronDown, Menu } from "lucide-react";

type WorkspaceHeaderProps = {
  showMenuButton: boolean;
  onMenuClick: () => void;
  onSidebarToggle: () => void;
};

export function WorkspaceHeader({ showMenuButton, onMenuClick, onSidebarToggle }: WorkspaceHeaderProps) {
  return (
    <header className="relative z-20 flex h-[4.5rem] items-center justify-between bg-transparent px-5 lg:px-7">
      <div className="flex items-center gap-3">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8ddd7] bg-white/88 text-[#10233a] shadow-sm backdrop-blur-md lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
        )}
        <button
          type="button"
          onClick={onSidebarToggle}
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#d8ddd7] bg-white/88 text-[#10233a] shadow-sm backdrop-blur-md transition hover:border-[#0b7b5b] hover:text-[#0b7b5b] lg:flex"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-base font-extrabold text-[#141b28]">
        <button className="flex items-center gap-3">
          <span className="h-12 w-12 rounded-full border border-white bg-[url('/assets/login-earth-bg.png')] bg-cover bg-center shadow-md" />
          <ChevronDown size={18} className="hidden sm:inline" />
        </button>
      </div>
    </header>
  );
}
