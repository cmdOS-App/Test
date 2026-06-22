import React, { useEffect, useState } from 'react';
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from 'react-icons/md';

interface Task {
  id: string;
  title: string;
  startTime: string; // Format: "14:00"
  endTime: string; // Format: "15:00"
}

interface HourlyScheduleProps {
  tasks: Task[];
  currentDate: Date;
}

const HourlySchedule: React.FC<HourlyScheduleProps> = ({ tasks, currentDate }) => {
  const [currentTimePosition, setCurrentTimePosition] = useState<number | null>(null);
  const [displayDate, setDisplayDate] = useState<Date>(currentDate);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');

  const hourHeight = 80; // Increased for more spacing
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i;
    return `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;
  });

  const isDarkMode = document.documentElement.classList.contains('dark');

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  };

  const getDayOfWeek = (date: Date) => {
    return date.toLocaleString('default', { weekday: 'short' }).toUpperCase();
  };

  const calculateTaskStyle = (startTime: string, endTime: string) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    const top = (start / 60) * hourHeight;
    const height = Math.max(((end - start) / 60) * hourHeight, 40); // Min height 40px

    return { top: `${top}px`, height: `${height}px` };
  };

  useEffect(() => {
    setDisplayDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    const updateCurrentTimePosition = () => {
      const now = new Date();
      if (now.toDateString() !== displayDate.toDateString()) {
        setCurrentTimePosition(null);
        return;
      }
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const top = (minutesSinceMidnight / 60) * hourHeight;
      setCurrentTimePosition(top);
    };

    updateCurrentTimePosition();
    const interval = setInterval(updateCurrentTimePosition, 60000);
    return () => clearInterval(interval);
  }, [displayDate]);

  return (
    <div
      className={`flex flex-col w-full h-full rounded-[2rem] overflow-hidden border ${
        isDarkMode ? 'bg-[#0a0a0a]/50 border-white/5' : 'bg-white border-black/5 shadow-inner'
      }`}>
      {/* Schedule Header */}
      <div
        className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span
              className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {getDayOfWeek(displayDate)}
            </span>
            <span className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatDate(displayDate)}
            </span>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 p-1 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
          {['day', 'week', 'month'].map(v => (
            <button
              key={v}
              onClick={() => setView(v as any)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                view === v
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : isDarkMode
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-neutral-400 hover:text-neutral-700'
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="flex w-full">
          {/* Time Labels Column */}
          <div
            className={`w-16 flex-none flex flex-col items-end pr-3 border-r ${isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-black/5 bg-black/[0.01]'}`}>
            {hours.map((hour, index) => (
              <div key={index} className="flex-none" style={{ height: `${hourHeight}px` }}>
                <span
                  className={`text-[9px] font-black tracking-tighter ${isDarkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  {hour}
                </span>
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="flex-1 relative">
            {hours.map((_, index) => (
              <div
                key={index}
                className={`border-b ${isDarkMode ? 'border-white/5' : 'border-black/5'}`}
                style={{ height: `${hourHeight}px` }}
              />
            ))}

            {/* Current Time Indicator */}
            {currentTimePosition !== null && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-red-500/50 z-30 pointer-events-none"
                style={{ top: `${currentTimePosition}px` }}>
                <div className="absolute left-0 w-2 h-2 bg-red-500 rounded-full -mt-0.75 shadow-lg shadow-red-500/40" />
              </div>
            )}

            {/* Tasks */}
            {tasks.map(task => {
              const style = calculateTaskStyle(task.startTime, task.endTime);
              return (
                <div
                  key={task.id}
                  className={`absolute left-2 right-4 px-4 py-3 rounded-2xl shadow-xl border-l-4 ${
                    isDarkMode
                      ? 'bg-blue-600/20 border-blue-500 text-blue-100 shadow-black/40'
                      : 'bg-blue-50 border-blue-600 text-blue-900 shadow-blue-900/5'
                  }`}
                  style={style}>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase opacity-60 tracking-widest">
                      {task.startTime} — {task.endTime}
                    </span>
                    <h4 className="text-xs font-black leading-tight truncate">{task.title}</h4>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HourlySchedule;
