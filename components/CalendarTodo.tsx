
import React, { useState, useMemo } from 'react';
import { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { useDataStore } from '../store/dataStore';
import { ChevronRight, ChevronLeft, CheckCircle2, Circle, Trash2, Plus, Calendar, StickyNote } from 'lucide-react';
import { CalendarEvent } from '../types';

export const CalendarTodo: React.FC = () => {
  const { calendarEvents, addCalendarEvent, toggleCalendarEvent, deleteCalendarEvent } = useDataStore();
  const [currentMonth, setCurrentMonth] = useState(new DateObject({ calendar: persian, locale: persian_fa }));
  const [selectedDay, setSelectedDay] = useState<string>(new DateObject({ calendar: persian, locale: persian_fa }).format("YYYY/MM/DD"));
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState<'TODO' | 'NOTE'>('TODO');

  // Constants
  const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const today = new DateObject({ calendar: persian, locale: persian_fa }).format("YYYY/MM/DD");

  const changeMonth = (amount: number) => {
    setCurrentMonth(new DateObject(currentMonth).add(amount, "month"));
  };

  const calendarDays = useMemo(() => {
    const firstDay = new DateObject(currentMonth).toFirstOfMonth();
    const daysInMonth = currentMonth.month.length;
    const startingDayIndex = firstDay.weekDay.index;

    const days = [];
    for (let i = 0; i < startingDayIndex; i++) {
        days.push({ day: null, dateStr: '' });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new DateObject(firstDay).setDay(i);
        const dateStr = dateObj.format("YYYY/MM/DD");
        // In Persian Calendar, index 6 is Friday (Jomeh)
        const isHoliday = dateObj.weekDay.index === 6; 
        days.push({ day: i, dateStr, isHoliday });
    }
    while (days.length % 7 !== 0) {
        days.push({ day: null, dateStr: '' });
    }
    return days;
  }, [currentMonth]);

  // Events for selected day
  const dayEvents = calendarEvents.filter(e => e.date === selectedDay);

  const handleAddEvent = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTaskTitle.trim()) return;

      const newEvent: CalendarEvent = {
          id: crypto.randomUUID(),
          date: selectedDay,
          title: newTaskTitle,
          isCompleted: false,
          type: newTaskType,
      };
      addCalendarEvent(newEvent);
      setNewTaskTitle('');
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 pb-16">
        
        {/* Left: Calendar Grid */}
        <div className="flex-1 flex flex-col bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <div className="flex items-center gap-4">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors">
                        <ChevronRight size={20} />
                    </button>
                    <h2 className="text-lg font-black text-gray-800 dark:text-white min-w-[140px] text-center">
                        {currentMonth.format("MMMM YYYY")}
                    </h2>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                </div>
                <button 
                    onClick={() => setSelectedDay(today)}
                    className="text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 px-3 py-1 rounded"
                >
                    برو به امروز
                </button>
            </div>

            <div className="grid grid-cols-7 bg-gray-100 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700">
                {weekDays.map((d, i) => (
                    <div key={i} className={`py-2 text-center text-xs font-bold ${i === 6 ? 'text-red-500' : 'text-gray-500 dark:text-neutral-400'}`}>
                        {d}
                    </div>
                ))}
            </div>

            <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-gray-50 dark:bg-black/20">
                {calendarDays.map((item, index) => {
                    if (!item.day) return <div key={index} className="border border-gray-100 dark:border-neutral-800/50 bg-gray-50/50 dark:bg-neutral-900/20"></div>;
                    
                    const isToday = item.dateStr === today;
                    const isSelected = item.dateStr === selectedDay;
                    const dayHasEvents = calendarEvents.some(e => e.date === item.dateStr);
                    const completedCount = calendarEvents.filter(e => e.date === item.dateStr && e.isCompleted).length;
                    const totalCount = calendarEvents.filter(e => e.date === item.dateStr && e.type === 'TODO').length;

                    return (
                        <div 
                            key={index}
                            onClick={() => setSelectedDay(item.dateStr)}
                            className={`relative border border-gray-100 dark:border-neutral-800 p-2 cursor-pointer transition-all hover:bg-blue-50 dark:hover:bg-neutral-800
                                ${isSelected ? 'ring-2 ring-inset ring-blue-500 z-10 bg-white dark:bg-neutral-800' : ''}
                                ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                                ${item.isHoliday ? 'bg-red-50/30 dark:bg-red-900/5' : ''}
                            `}
                        >
                            <div className={`text-sm font-bold mb-1 flex justify-between ${item.isHoliday ? 'text-red-500' : isToday ? 'text-blue-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                <span>{item.day}</span>
                                {isToday && <span className="text-[9px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1 rounded">امروز</span>}
                            </div>
                            
                            {dayHasEvents && (
                                <div className="mt-2 flex gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    {totalCount > 0 && totalCount === completedCount && (
                                        <CheckCircle2 size={10} className="text-emerald-500" />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Right: Day List */}
        <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-surface border border-gray-200 dark:border-neutral-800 shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <h3 className="font-black text-gray-800 dark:text-white flex items-center gap-2">
                    <Calendar size={18} className="text-blue-600" />
                    برنامه {selectedDay}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {dayEvents.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-10 flex flex-col items-center">
                        <StickyNote size={48} className="mb-2 opacity-20" />
                        هیچ یادداشت یا کاری برای این روز ثبت نشده است.
                    </div>
                ) : (
                    dayEvents.map(event => (
                        <div key={event.id} className="group flex items-start gap-3 p-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg hover:border-blue-300 transition-colors">
                            {event.type === 'TODO' ? (
                                <button 
                                    onClick={() => toggleCalendarEvent(event.id)}
                                    className={`mt-0.5 ${event.isCompleted ? 'text-emerald-500' : 'text-gray-400 hover:text-blue-500'}`}
                                >
                                    {event.isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                            ) : (
                                <StickyNote size={20} className="text-amber-500 mt-0.5" />
                            )}
                            
                            <div className={`flex-1 text-sm ${event.isCompleted ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                                {event.title}
                            </div>

                            <button onClick={() => deleteCalendarEvent(event.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <form onSubmit={handleAddEvent} className="flex flex-col gap-2">
                    <div className="flex bg-white dark:bg-black rounded border border-gray-200 dark:border-neutral-700 p-1">
                        <button
                            type="button"
                            onClick={() => setNewTaskType('TODO')}
                            className={`flex-1 text-xs font-bold py-1.5 rounded transition-colors ${newTaskType === 'TODO' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
                        >
                            کار (Todo)
                        </button>
                        <button
                            type="button"
                            onClick={() => setNewTaskType('NOTE')}
                            className={`flex-1 text-xs font-bold py-1.5 rounded transition-colors ${newTaskType === 'NOTE' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
                        >
                            یادداشت
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            placeholder={newTaskType === 'TODO' ? "چه کاری باید انجام دهید؟" : "یادداشت خود را بنویسید..."}
                            className="flex-1 p-2 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded text-sm outline-none focus:border-blue-500"
                        />
                        <button 
                            type="submit"
                            disabled={!newTaskTitle.trim()}
                            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
  );
};
