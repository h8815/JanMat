import React from 'react';
import { FileQuestion } from 'lucide-react';

const EmptyState = ({ icon: Icon = FileQuestion, title, message, actionButton = null }) => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl dark:bg-slate-800/50 dark:border-slate-700">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 dark:bg-slate-800">
                <Icon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2 dark:text-slate-200">{title}</h3>
            <p className="text-sm text-slate-500 max-w-sm dark:text-slate-400 mb-6">{message}</p>
            {actionButton && <div>{actionButton}</div>}
        </div>
    );
};

export default EmptyState;
