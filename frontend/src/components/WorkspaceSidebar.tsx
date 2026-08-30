import { Bell, ChevronRight, Clock3, Copy, FileText, Menu, Plus, Sparkles } from "lucide-react";
import { OrbivueLogo } from "./OrbivueLogo";

type WorkspaceSidebarProps = {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onOpenRecentChat: (title: string, subtitle: string) => void;
};

const navItems = [
  { label: "Ask OrbiVue", icon: Sparkles, active: true },
  { label: "Compare", icon: Copy },
  { label: "Time", icon: Clock3 },
  { label: "Reports", icon: FileText },
  { label: "Alerts", icon: Bell },
];

const recentChats = [
  { title: "Amazon Rainforest", subtitle: "Deforestation Analysis", date: "Today" },
  { title: "Coastal Erosion", subtitle: "Change Over Time", date: "Yesterday" },
  { title: "Himalayan Glacier", subtitle: "Retreat Study", date: "May 13" },
  { title: "Urban Expansion", subtitle: "Global Trends", date: "May 12" },
  { title: "Coral Reef Bleaching", subtitle: "Impact Assessment", date: "May 10" },
];

export function WorkspaceSidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse,
  onNewChat,
  onOpenRecentChat,
}: WorkspaceSidebarProps) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-[#10233a]/30 transition-opacity lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#d8ddd7] bg-[#fbf8f0]/96 py-5 text-[#0f2d46] shadow-[20px_0_60px_rgba(16,35,58,0.12)] transition-[width,transform,padding] duration-300 lg:static lg:translate-x-0 lg:shadow-none ${
          isCollapsed ? "lg:w-[68px] lg:px-3" : "lg:w-[236px] lg:px-3.5"
        } w-[255px] px-4 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`flex items-center ${isCollapsed ? "lg:justify-center" : "justify-between"}`}>
          <OrbivueLogo
            className={`!max-w-none transition-all duration-300 ${
              isCollapsed ? "lg:!w-[46px]" : "!w-[190px]"
            }`}
          />
          <button
            type="button"
            className="rounded-full p-2 text-[#0f2d46] lg:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <Menu size={20} />
          </button>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className={`mt-7 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00624b] text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(0,98,75,0.22)] transition hover:bg-[#004d3b] ${
            isCollapsed ? "lg:px-0" : ""
          }`}
          title="New chat"
        >
          <Plus size={18} />
          <span className={isCollapsed ? "lg:hidden" : ""}>New chat</span>
        </button>

        <nav className="mt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  isCollapsed ? "lg:justify-center lg:px-0" : ""
                } ${
                  item.active
                    ? "bg-[#e8f2ed] text-[#005b46]"
                    : "text-[#10233a] hover:bg-white"
                }`}
                title={item.label}
              >
                <Icon size={19} strokeWidth={1.9} />
                <span className={isCollapsed ? "lg:hidden" : ""}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={`mt-5 border-t border-[#d8ddd7] pt-4 ${isCollapsed ? "lg:hidden" : ""}`}>
          <div className="mb-3 flex items-center justify-between text-sm font-bold">
            <span>Recent chats</span>
            <span className="text-lg leading-none">⌃</span>
          </div>
          <div className="space-y-2.5">
            {recentChats.map((chat) => (
              <button
                key={chat.title}
                type="button"
                onClick={() => onOpenRecentChat(chat.title, chat.subtitle)}
                className="group flex w-full gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-white"
              >
                <Sparkles size={17} className="mt-1 shrink-0 text-[#133a5d]" />
                <span className="min-w-0">
                  <span className="block text-[0.82rem] font-semibold leading-5 text-[#10233a]">
                    {chat.title}
                  </span>
                  <span className="block text-[0.82rem] font-semibold leading-5 text-[#10233a]">
                    {chat.subtitle}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#637487]">{chat.date}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={isCollapsed ? onToggleCollapse : undefined}
          className={`mt-auto flex h-10 items-center justify-between rounded-xl border border-[#d8ddd7] bg-white/70 px-4 text-sm font-semibold text-[#10233a] shadow-sm ${
            isCollapsed ? "lg:justify-center lg:px-0" : ""
          }`}
          title={isCollapsed ? "Expand sidebar" : "View all chats"}
        >
          <span className="flex items-center gap-2">
            <FileText size={17} />
            <span className={isCollapsed ? "lg:hidden" : ""}>View all chats</span>
          </span>
          <ChevronRight size={18} className={isCollapsed ? "lg:hidden" : ""} />
        </button>
      </aside>
    </>
  );
}
