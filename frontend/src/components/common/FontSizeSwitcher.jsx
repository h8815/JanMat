import React, { useState, useEffect } from 'react';

const FontSizeSwitcher = () => {
    const [fontSize, setFontSize] = useState(16);

    useEffect(() => {
        document.documentElement.style.fontSize = `${fontSize}px`;
    }, [fontSize]);

    const changeFontSize = (step) => {
        setFontSize(prev => {
            const newSize = prev + step;
            if (newSize >= 12 && newSize <= 24) return newSize;
            return prev;
        });
    };

    const resetFontSize = () => setFontSize(16);

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={() => changeFontSize(-2)}
                className="w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus:ring-2 focus:ring-janmat-blue/30"
                aria-label="Decrease font size"
                title="Decrease font size"
            >
                A-
            </button>
            <button
                onClick={resetFontSize}
                className="w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus:ring-2 focus:ring-janmat-blue/30"
                aria-label="Normal font size"
                title="Normal font size"
            >
                A
            </button>
            <button
                onClick={() => changeFontSize(2)}
                className="w-7 h-7 flex items-center justify-center text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors focus:ring-2 focus:ring-janmat-blue/30"
                aria-label="Increase font size"
                title="Increase font size"
            >
                A+
            </button>
        </div>
    );
};

export default FontSizeSwitcher;
