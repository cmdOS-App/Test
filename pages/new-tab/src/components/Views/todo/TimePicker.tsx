import React from 'react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
}

const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, isDarkMode }) => {
  const [hours, minutes] = value.split(':').map(Number);

  const handleHourSelect = (h: number) => {
    const formattedHour = String(h).padStart(2, '0');
    const formattedMinute = String(minutes).padStart(2, '0');
    onChange(`${formattedHour}:${formattedMinute}`);
  };

  const handleMinuteSelect = (m: number) => {
    const formattedHour = String(hours).padStart(2, '0');
    const formattedMinute = String(m).padStart(2, '0');
    onChange(`${formattedHour}:${formattedMinute}`);
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);
  const minuteOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div className={`p-4 rounded-2xl border shadow-2xl w-[320px] ${
      isDarkMode ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-slate-200'
    }`}>
      <div className="flex flex-row gap-6">
        {/* Left Side: Hours */}
        <div className="flex-1">
          <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 text-center ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
            Hours
          </div>
          <div className="grid grid-cols-3 gap-1">
            {hourOptions.map(h => (
              <button
                key={h}
                onClick={() => handleHourSelect(h)}
                className={`h-8 w-8 rounded-lg text-[11px] font-bold transition-all ${
                  h === hours
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : isDarkMode 
                      ? 'text-white/60 hover:bg-white/10 hover:text-white' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {String(h).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>

        {/* Vertical Divider */}
        <div className={`w-[1px] self-stretch ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`} />

        {/* Right Side: Minutes */}
        <div className="flex-1">
          <div className={`text-[10px] font-bold uppercase tracking-widest mb-3 text-center ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>
            Minutes
          </div>
          <div className="grid grid-cols-2 gap-1">
            {minuteOptions.map(m => (
              <button
                key={m}
                onClick={() => handleMinuteSelect(m)}
                className={`h-8 w-12 rounded-lg text-[11px] font-bold transition-all ${
                  m === minutes
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : isDarkMode 
                      ? 'text-white/60 hover:bg-white/10 hover:text-white' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {String(m).padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimePicker;
