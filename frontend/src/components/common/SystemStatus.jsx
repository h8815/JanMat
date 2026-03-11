import React, { useState, useEffect } from 'react';
import { Wifi, Fingerprint } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SystemStatus = ({ biometricStatus = 'Ready' }) => {
    const { t } = useTranslation();
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-3 border-r border-slate-200">
            {/* Network Status */}
            <div className="flex items-center gap-1.5" title="Network Status">
                <Wifi className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isOnline ? 'text-green-600' : 'text-red-500'}`} />
                <span className="hidden sm:inline text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                    {isOnline ? 'Online' : 'Offline'}
                </span>
            </div>

            {/* Biometric Status */}
            <div className="flex items-center gap-1.5" title="Biometric Device">
                <Fingerprint className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${biometricStatus === 'Ready' || biometricStatus === 'Connected' ? 'text-green-600' : 'text-amber-500'
                    }`} />
                <span className="hidden sm:inline text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                    {biometricStatus}
                </span>
            </div>
        </div>
    );
};

export default SystemStatus;
