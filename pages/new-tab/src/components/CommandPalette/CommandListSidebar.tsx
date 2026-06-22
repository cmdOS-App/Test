import { FaTerminal, FaLink, FaStickyNote, FaCog, FaPalette } from 'react-icons/fa';

interface CommandListSidebarProps {
  activeView?: string;
  onSelect?: (view: string) => void;
}

const CommandListSidebar: React.FC<CommandListSidebarProps> = ({ activeView = 'commands', onSelect }) => {
  const items = [
    { id: 'commands', label: 'Commands', icon: <FaTerminal size={14} /> },
    { id: 'links', label: 'Links', icon: <FaLink size={14} /> },
    { id: 'notes', label: 'Notes', icon: <FaStickyNote size={14} /> },
    { id: 'settings', label: 'Settings', icon: <FaCog size={14} /> },
    { id: 'themes', label: 'Themes', icon: <FaPalette size={14} /> },
  ];

  return (
    <div className="w-48 h-full flex flex-col bg-transparent px-3 py-4 font-sans text-neutral-700 dark:text-neutral-200 border-r border-neutral-200 dark:border-white/10">
      <div className="flex-1 flex flex-col gap-2">
        {items.map(item => {
          const isActive = activeView === item.id;

          return (
            <div
              key={item.label}
              onClick={() => onSelect?.(item.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
                isActive
                  ? 'bg-white shadow-sm text-neutral-900 dark:bg-white/10 dark:text-neutral-100 font-medium'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-white/50 dark:hover:bg-white/5'
              }`}>
              <div
                className={`w-5 h-5 flex items-center justify-center ${isActive ? 'text-neutral-700 dark:text-neutral-200' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {item.icon}
              </div>
              <span className="text-sm">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CommandListSidebar;
