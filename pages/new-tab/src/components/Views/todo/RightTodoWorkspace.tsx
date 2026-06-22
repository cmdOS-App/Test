import React, { useEffect } from 'react';
import { BsPinAngleFill } from 'react-icons/bs';
import TodosList from './TodosList';

interface RightTodoWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn?: boolean;
  isCreateModalOnly?: boolean;
}

const RightTodoWorkspace: React.FC<RightTodoWorkspaceProps> = ({
  isOpen,
  onClose,
  isLoggedIn,
  isCreateModalOnly,
}) => {
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={
        isCreateModalOnly
          ? "fixed inset-0 z-[45] pointer-events-none"
          : `fixed right-4 top-[14vh] min-h-[65vh] max-h-[85vh] w-[360px] z-[45] flex flex-col border rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode
                ? 'bg-frostedwhite border-white/10 backdrop-blur-md'
                : 'bg-[#fdf6e3]/90 border-[#eee8d5]/80 backdrop-blur-md'
            }`
      }
    >
      {/* Content */}
      <div className={isCreateModalOnly ? "fixed inset-0 pointer-events-auto" : "flex-1 min-h-0 overflow-y-auto relative custom-scrollbar"}>
        <TodosList
          isOpen={isOpen}
          onClose={onClose}
          isLoggedIn={isLoggedIn}
          isSidebar={!isCreateModalOnly}
          isCreateModalOnly={isCreateModalOnly}
        />
      </div>
    </div>
  );
};

export default RightTodoWorkspace;
