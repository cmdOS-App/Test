import type React from 'react';

interface WorkspaceSkeletonProps {
  isCollapsed?: boolean;
}

export const WorkspaceSkeleton: React.FC<WorkspaceSkeletonProps> = ({ isCollapsed = false }) => {
  return (
    <div className={`space-y-4 p-2 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
      {[...Array(4)].map((_, idx) => (
        <div
          key={idx}
          className={`${isCollapsed ? 'w-8 h-8 rounded-full' : 'h-10 rounded-md'} bg-[var(--color-containerBg)]`}
        />
      ))}
    </div>
  );
};
