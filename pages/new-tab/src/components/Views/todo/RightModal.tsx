import React, { useState, useEffect } from 'react';
import HourlySchedule from './HourlySchedule';
import MonthYearCalendar from './MonthYearCalendar';
import { getUpcomingTodos, getOverdueTodos } from '../../../../../Apis/features/snippetApi';
import { useSelector } from 'react-redux';
import { selectAllData } from '../../../../../Redux/AllData/allDataSlice';

interface TodoItem {
  snippet_id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
  folder_id: string;
  workspace_id: string | null;
  is_todo_type: boolean;
  is_recurring: boolean;
  recurring_cycle: string | null;
  event_deadline: string;
  is_done: boolean;
}

interface Task {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface UsageStats {
  commands: number;
  tasks: number;
  notes: number;
  totalTimeMinutes: number;
  breakdown: {
    commands: number; // minutes
    tasks: number; // minutes
    notes: number; // minutes
  };
}

const isTodoOnDate = (todoEventDeadline: string, date: Date): boolean => {
  const todoDate = new Date(todoEventDeadline);
  return (
    todoDate.getFullYear() === date.getFullYear() &&
    todoDate.getMonth() === date.getMonth() &&
    todoDate.getDate() === date.getDate()
  );
};

const transformTodoToTask = (todo: TodoItem, defaultDurationMinutes: number = 60): Task => {
  const startDate = new Date(todo.event_deadline);
  const endDate = new Date(startDate.getTime() + defaultDurationMinutes * 60000);
  const formatTime = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  return {
    id: todo.snippet_id,
    title: todo.key,
    startTime: formatTime(startDate),
    endTime: formatTime(endDate),
  };
};

interface RightModalLeftPanelProps {
  scheduleTasks: Task[];
  selectedDate: Date;
  isDarkMode: boolean;
}

const RightModalLeftPanel: React.FC<RightModalLeftPanelProps> = ({ scheduleTasks, selectedDate, isDarkMode }) => {
  return (
    <div className={`w-2/3 h-full flex flex-col border-r ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
      <div className="flex-1 overflow-hidden p-6">
        <HourlySchedule tasks={scheduleTasks} currentDate={selectedDate} />
      </div>
    </div>
  );
};

interface RightModalRightPanelProps {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  stats: UsageStats;
  isDarkMode: boolean;
  formatStatsTime: (totalMinutes: number) => string;
}

const RightModalRightPanel: React.FC<RightModalRightPanelProps> = ({
  selectedDate,
  setSelectedDate,
  stats,
  isDarkMode,
  formatStatsTime,
}) => {
  return (
    <div className={`w-1/3 h-full p-6 overflow-y-auto ${isDarkMode ? 'bg-black/5' : 'bg-neutral-50/50'}`}>
      <MonthYearCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />

      <div
        className={`mt-8 p-6 rounded-[2.5rem] border transition-all duration-300 ${
          isDarkMode ? 'bg-[var(--color-popupBg)] border-white/5 shadow-2xl' : 'bg-white border-black/5 shadow-xl shadow-black/5'
        }`}>
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-blue-500' : 'bg-blue-600'}`} />
          <h4
            className={`text-[10px] font-black tracking-[0.2em] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
            TODAY
          </h4>
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatStatsTime(stats.totalTimeMinutes)}
            </span>
            <span className="text-green-500 text-[10px] font-black tracking-tighter">+12%</span>
          </div>
          <p className={`text-[10px] font-bold mt-1 opacity-40 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            vs yesterday
          </p>
        </div>

        {/* Premium Progress Bar Breakdown */}
        <div
          className={`h-1.5 w-full rounded-full overflow-hidden flex mb-8 ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${(stats.breakdown.commands / (stats.totalTimeMinutes || 1)) * 100}%` }}
          />
          <div
            className="h-full bg-blue-400 transition-all duration-500"
            style={{ width: `${(stats.breakdown.tasks / (stats.totalTimeMinutes || 1)) * 100}%` }}
          />
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${(stats.breakdown.notes / (stats.totalTimeMinutes || 1)) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span
                className={`text-[9px] font-black tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                COMMANDS
              </span>
            </div>
            <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatStatsTime(stats.breakdown.commands)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span
                className={`text-[9px] font-black tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                TASKS
              </span>
            </div>
            <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatStatsTime(stats.breakdown.tasks)}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span
                className={`text-[9px] font-black tracking-widest ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
                NOTES
              </span>
            </div>
            <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
              {formatStatsTime(stats.breakdown.notes)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const RightModal: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scheduleTasks, setScheduleTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<UsageStats>({
    commands: 0,
    tasks: 0,
    notes: 0,
    totalTimeMinutes: 0,
    breakdown: { commands: 0, tasks: 0, notes: 0 },
  });

  const allData = useSelector(selectAllData);

  const isDarkMode = document.documentElement.classList.contains('dark');

  const getGreetingData = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: 'Yes, Good morning', name: 'Sai' };
    if (hour >= 12 && hour < 17) return { text: 'Yes, Good afternoon', name: 'Sai' };
    if (hour >= 17 && hour < 21) return { text: 'Yes, Good evening', name: 'Sai' };
    return { text: 'Yes, Good night', name: '' };
  };

  useEffect(() => {
    const fetchAndSetTasks = async () => {
      setIsLoading(true);
      try {
        const overdueResults = await getOverdueTodos();
        const upcomingResults = await getUpcomingTodos();
        const overdueTodos = Array.isArray(overdueResults) ? overdueResults : (overdueResults as any)?.todos || [];
        const upcomingTodos = Array.isArray(upcomingResults) ? upcomingResults : (upcomingResults as any)?.todos || [];
        const allFetchedTodos = [...overdueTodos, ...upcomingTodos];

        const tasksForSelectedDate = allFetchedTodos
          .filter(todo => todo.is_todo_type && !todo.is_done && isTodoOnDate(todo.event_deadline, selectedDate))
          .map(todo => transformTodoToTask(todo));
        setScheduleTasks(tasksForSelectedDate);

        // Calculate Stats from Chrome Storage
        const todayKey = new Date().toISOString().split('T')[0];
        let usageData: any = {};
        try {
          const chromeAny = (window as any).chrome;
          if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve =>
              chromeAny.storage.local.get('counters_daily_v1', resolve),
            );
            const store = result.counters_daily_v1 || {};
            usageData = store.days?.[todayKey]?.counts || {};
          }
        } catch (e) {
          console.warn('Failed to fetch usage data from chrome storage', e);
        }

        // Real counts
        const noteOpens = Number(usageData.note_open_count || 0);
        const commandExecs = Number(usageData.command_count || 0);
        const tasksPending = tasksForSelectedDate.length;
        const tasksDoneToday = allFetchedTodos.filter(
          t => t.is_todo_type && t.is_done && isTodoOnDate(t.updated_at, new Date()),
        ).length;

        // Estimate time (minutes)
        const cmdTime = commandExecs * 3; // 3 min per command
        const taskTime = tasksDoneToday * 15 + tasksPending * 2; // 15 min per done, 2 min per pending
        const noteTime = noteOpens * 2; // 2 min per note open

        setStats({
          commands: commandExecs,
          tasks: tasksPending + tasksDoneToday,
          notes: noteOpens,
          totalTimeMinutes: cmdTime + taskTime + noteTime,
          breakdown: {
            commands: cmdTime,
            tasks: taskTime,
            notes: noteTime,
          },
        });
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndSetTasks();
  }, [selectedDate, allData]);

  const formatStatsTime = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {/* Dynamic Greeting Header */}
      <div className={`p-8 pb-6 border-b text-center ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
        <h2
          className={`text-xl font-black tracking-tighter animate-fadeIn ${isDarkMode ? 'text-white' : 'text-neutral-900'}`}>
          {getGreetingData().text}
          {getGreetingData().name && (
            <>
              , <span className="text-blue-600">{getGreetingData().name}</span>
            </>
          )}
        </h2>
        <p
          className={`text-[9px] font-black tracking-[0.2em] mt-1 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
          Timeline Overview
        </p>
      </div>

      {/* Two-Column Content Layout */}
      <div className="flex flex-1 overflow-hidden">
        <RightModalLeftPanel scheduleTasks={scheduleTasks} selectedDate={selectedDate} isDarkMode={isDarkMode} />
        <RightModalRightPanel
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          stats={stats}
          isDarkMode={isDarkMode}
          formatStatsTime={formatStatsTime}
        />
      </div>
    </div>
  );
};

export default RightModal;
