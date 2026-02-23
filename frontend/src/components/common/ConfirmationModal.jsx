import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDanger = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 dark:bg-slate-800 dark:border dark:border-slate-700 relative mt-auto sm:mt-0">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-6 pt-8 text-center sm:text-left sm:flex sm:items-start sm:gap-4">
                    <div className={`mx-auto sm:mx-0 flex shrink-0 items-center justify-center h-12 w-12 rounded-full mb-4 sm:mb-0 ${isDanger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                        <AlertTriangle className={`h-6 w-6 ${isDanger ? 'text-red-600 dark:text-red-400' : 'text-janmat-blue dark:text-janmat-light'}`} aria-hidden="true" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            {title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 dark:bg-slate-900/50 pb-8 sm:pb-4">
                    <button
                        type="button"
                        className="w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={`w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] font-bold text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors shadow-sm ${isDanger
                            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                            : 'bg-janmat-blue hover:bg-janmat-hover focus:ring-janmat-blue'
                            }`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
