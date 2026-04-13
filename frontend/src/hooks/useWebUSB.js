import { useState, useEffect } from 'react';

export const useWebUSB = () => {
    const [isPlugged, setIsPlugged] = useState(false);

    useEffect(() => {
        if (!navigator.usb) {
            console.warn("WebUSB API not supported in this browser.");
            return;
        }

        const checkDevices = async () => {
            try {
                const devices = await navigator.usb.getDevices();
                setIsPlugged(devices.length > 0);
            } catch (e) {
                console.error("Error checking devices:", e);
            }
        };
        checkDevices();

        const handleConnect = () => {
            setIsPlugged(true);
        };
        
        const handleDisconnect = () => {
            // Re-evaluating available devices ensures it only triggers false 
            // if ALL permitted devices are disconnected.
            navigator.usb.getDevices().then(devices => {
                setIsPlugged(devices.length > 0);
            }).catch(() => {
                setIsPlugged(false);
            });
        };

        navigator.usb.addEventListener('connect', handleConnect);
        navigator.usb.addEventListener('disconnect', handleDisconnect);

        return () => {
            navigator.usb.removeEventListener('connect', handleConnect);
            navigator.usb.removeEventListener('disconnect', handleDisconnect);
        };
    }, []);

    const requestDevice = async () => {
        if (!navigator.usb) {
            alert("WebUSB is not supported in this browser. Please use Chrome or Edge.");
            return;
        }
        try {
            // Requesting with empty filters allows any standard USB device to be selected
            await navigator.usb.requestDevice({ filters: [] });
            setIsPlugged(true);
        } catch (e) {
            console.log("USB Selection cancelled or failed:", e);
        }
    };

    return { isPlugged, requestDevice };
};
