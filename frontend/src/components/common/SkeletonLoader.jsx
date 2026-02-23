import React from 'react';

const SkeletonLoader = ({ type = 'text', count = 1, className = '' }) => {
    // Generate an array of skeletons based on the count prop
    const skeletons = Array(count).fill(0);

    const getBaseClasses = () => {
        // Tailwind animate-pulse provides the shimmer effect
        const base = "animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md ";

        switch (type) {
            case 'text':
                // A standard text line skeleton
                return base + "h-4 w-full mb-2 " + className;
            case 'title':
                // A larger text skeleton for headings
                return base + "h-6 w-3/4 mb-4 " + className;
            case 'avatar':
                // A circular skeleton
                return base + "h-12 w-12 rounded-full " + className;
            case 'card':
                // A rectangular block skeleton typical for cards
                return base + "h-32 w-full " + className;
            case 'table-row':
                // A thin, full width row skeleton
                return base + "h-10 w-full mb-1 " + className;
            case 'stat':
                // A specialized skeleton for stat cards (like in Admin Dashboard)
                return base + "h-24 w-full rounded-xl " + className;
            default:
                return base + className;
        }
    };

    return (
        <>
            {skeletons.map((_, index) => (
                <div key={index} className={getBaseClasses()}></div>
            ))}
        </>
    );
};

export default SkeletonLoader;
