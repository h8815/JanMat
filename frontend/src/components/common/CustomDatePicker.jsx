import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const CustomDatePicker = ({
    value,
    onChange,
    minDate,
    maxDate,
    placeholder = "Select date",
    label
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
    const dropdownRef = useRef(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Formatting helper
    const formatDateForDisplay = (dateString) => {
        if (!dateString) return "";
        const d = new Date(dateString);
        return `${d.getDate()} ${monthNames[d.getMonth()].substring(0, 3)} ${d.getFullYear()}`;
    };

    // Handle Month Navigation
    const prevMonth = (e) => {
        e.preventDefault();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = (e) => {
        e.preventDefault();
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    // Handle Date Selection
    const handleDateSelect = (day) => {
        const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        // Format as YYYY-MM-DD for the value
        const formatted = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

        onChange(formatted);
        setIsOpen(false);
    };

    // Generate Calendar Grid
    const renderCalendarDays = () => {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Pad start of month
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
        }

        // Fill days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateToCheck = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            dateToCheck.setHours(0, 0, 0, 0);

            const isSelected = value && new Date(value).getTime() === dateToCheck.getTime();
            const isToday = today.getTime() === dateToCheck.getTime();

            // Min/Max boundaries
            let isDisabled = false;
            if (minDate) {
                const min = new Date(minDate);
                min.setHours(0, 0, 0, 0);
                if (dateToCheck < min) isDisabled = true;
            }
            if (maxDate) {
                const max = new Date(maxDate);
                max.setHours(0, 0, 0, 0);
                if (dateToCheck > max) isDisabled = true;
            }

            days.push(
                <button
                    key={day}
                    onClick={(e) => {
                        e.preventDefault();
                        if (!isDisabled) handleDateSelect(day);
                    }}
                    disabled={isDisabled}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                        ${isSelected ? 'bg-janmat-blue text-white shadow-md dark:bg-janmat-light dark:text-janmat-blue'
                            : isDisabled ? 'text-slate-300 cursor-not-allowed dark:text-slate-600'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        }
                        ${isToday && !isSelected ? 'ring-2 ring-janmat-blue/30 text-janmat-blue font-bold dark:ring-janmat-light/50 dark:text-janmat-light' : ''}
                    `}
                >
                    {day}
                </button>
            );
        }

        return days;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {label && <label className="block text-xs text-slate-500 mb-1">{label}</label>}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-janmat-blue
                    ${isOpen
                        ? 'border-janmat-blue bg-blue-50/50 shadow-[0_0_0_4px_rgba(11,61,145,0.05)] dark:bg-janmat-blue/10 dark:border-janmat-blue/50'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:hover:bg-slate-600'
                    }
                `}
            >
                <span className={value ? 'text-slate-800 font-medium dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
                    {value ? formatDateForDisplay(value) : placeholder}
                </span>
                <CalendarIcon className={`w-4 h-4 transition-colors ${isOpen ? 'text-janmat-blue dark:text-janmat-light' : 'text-slate-400 dark:text-slate-500'}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-xl border border-slate-100 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] z-50 w-64 animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/80">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={prevMonth}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors dark:hover:bg-slate-700 dark:text-slate-400"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="font-bold text-slate-800 dark:text-white">
                            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </div>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors dark:hover:bg-slate-700 dark:text-slate-400"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Day Names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider dark:text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {renderCalendarDays()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomDatePicker;
