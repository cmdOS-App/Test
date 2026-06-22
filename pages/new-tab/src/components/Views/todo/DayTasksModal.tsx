import React from 'react';
import { MdClose } from 'react-icons/md';

interface Task {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  date: Date;
}

interface DayTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

const DayTasksModal: React.FC<DayTasksModalProps> = ({ isOpen, onClose, date, tasks, onTaskClick }) => {
  if (!isOpen || !date) return null;

  const formatTime = (timeString: string) => {
    const [hour, minute] = timeString.split(':').map(Number);
    const d = new Date();
    d.setHours(hour, minute);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const timeA = new Date(`2000-01-01T${a.startTime}`).getTime();
    const timeB = new Date(`2000-01-01T${b.startTime}`).getTime();
    return timeA - timeB;
  });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
      onClick={onClose} // Close when clicking outside modal content
    >
      <div
        className="bg-[var(--color-containerBg)] rounded-lg shadow-xl w-80 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent clicks inside from closing modal
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
          <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">
            {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-iconDefault)] hover:text-gray-900 dark:hover:text-white">
            <MdClose size={20} />
          </button>
        </div>

        {/* Task List */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {sortedTasks.length === 0 ? (
            <p className="text-center text-[13px] font-bold text-gray-600 dark:text-gray-400">No tasks for this day.</p>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-blue-500 text-white rounded px-2 py-1 text-sm cursor-pointer hover:bg-blue-600 transition-colors truncate"
                  onClick={() => onTaskClick(task)}
                  title={task.title}>
                  <span className="font-semibold mr-1">{formatTime(task.startTime)}</span>
                  {task.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayTasksModal;
