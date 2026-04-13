import { createContext, useContext, useState, useEffect } from 'react';

const FontSizeContext = createContext();

export const useFontSize = () => useContext(FontSizeContext);

const FONT_SIZES = {
    small: '14px',
    normal: '16px',
    large: '18px',
};

export const FontSizeProvider = ({ children }) => {
    const [fontSize, setFontSize] = useState(() => {
        return localStorage.getItem('janmat_font_size') || 'normal';
    });

    useEffect(() => {
        document.documentElement.style.fontSize = FONT_SIZES[fontSize];
        localStorage.setItem('janmat_font_size', fontSize);
    }, [fontSize]);

    const decrease = () => setFontSize('small');
    const reset = () => setFontSize('normal');
    const increase = () => setFontSize('large');

    return (
        <FontSizeContext.Provider value={{ fontSize, decrease, reset, increase }}>
            {children}
        </FontSizeContext.Provider>
    );
};

export default FontSizeContext;
