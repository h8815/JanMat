import React, { useState, useEffect } from 'react';
import { Home, Users, AlertOctagon, FileText, Activity, LogOut, X, ChevronLeft, ChevronRight } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, user, logout, isOpen, onClose, isCollapsed, setIsCollapsed }) => {
    // Add effect to prevent body scroll and horizontal overflow when sidebar is open on mobile
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Backdrop for mobile
    const backdropClass = isOpen
        ? "fixed inset-0 bg-black/50 z-40 md:hidden"
        : "hidden";

    // Sidebar classes - Light Theme & Dynamic Width
    const sidebarClass = `
        fixed top-0 left-0 h-screen bg-white text-slate-700
        overflow-y-auto overflow-x-hidden
        z-50 ${isCollapsed ? 'md:w-[111px]' : 'md:w-[280px]'} w-[280px] 
        transform transition-all duration-300 ease-in-out font-sans shadow-xl md:shadow-none
        ${isOpen ? "translate-x-0" : "-translate-x-full"} 
        md:translate-x-0 md:flex border-r border-slate-200 flex flex-col
    `.trim().replace(/\s+/g, ' ');

    return (
        <>
            {/* Mobile Backdrop */}
            <div className={backdropClass} onClick={onClose} />

            {/* Sidebar */}
            <nav
                className={sidebarClass}
                style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                }}
            >
                {/* Header Section */}
                <div className={`flex items-center p-4 mb-2 relative border-b border-transparent min-h-[60px] justify-between ${isCollapsed ? 'md:justify-center' : ''}`}>

                    {/* Logo/Title */}
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="bg-orange-50 p-1.5 rounded-lg flex-shrink-0 border border-orange-100">
                            <img src="/assets/images/ashoka.png" alt="Emblem" className="h-6 w-6 object-contain" />
                        </div>

                        {/* Text: Hidden on Desktop if collapsed, visible on Mobile */}
                        <div className={`transition-opacity duration-200 fade-in overflow-hidden ${isCollapsed ? 'md:hidden' : ''}`}>
                            <h1 className="text-sm font-bold tracking-wide whitespace-nowrap text-slate-900">JanMat</h1>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider whitespace-nowrap">Admin Portal</p>
                        </div>
                    </div>

                    {/* Desktop Toggle Button */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden md:flex text-slate-400 hover:text-janmat-blue hover:bg-slate-100 p-1.5 rounded-md transition-colors absolute right-2 flex-shrink-0"
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>

                    {/* Mobile Close Button */}
                    <button onClick={onClose} className="md:hidden text-slate-400 hover:text-slate-600 flex-shrink-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 space-y-1 py-4">
                    <NavItem
                        icon={<Home className="w-5 h-5" />}
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        collapsed={isCollapsed}
                        onClick={() => { setActiveTab('dashboard'); onClose(); }}
                    />
                    <NavItem
                        icon={<Users className="w-5 h-5" />}
                        label="Operators"
                        active={activeTab === 'operators'}
                        collapsed={isCollapsed}
                        onClick={() => { setActiveTab('operators'); onClose(); }}
                    />
                    <NavItem
                        icon={<AlertOctagon className="w-5 h-5" />}
                        label="Fraud Logs"
                        active={activeTab === 'fraud'}
                        collapsed={isCollapsed}
                        onClick={() => { setActiveTab('fraud'); onClose(); }}
                    />
                    <NavItem
                        icon={<FileText className="w-5 h-5" />}
                        label="Audit Logs"
                        active={activeTab === 'audit'}
                        collapsed={isCollapsed}
                        onClick={() => { setActiveTab('audit'); onClose(); }}
                    />
                    <NavItem
                        icon={<Activity className="w-5 h-5" />}
                        label="Settings"
                        active={activeTab === 'settings'}
                        collapsed={isCollapsed}
                        onClick={() => { setActiveTab('settings'); onClose(); }}
                    />
                </div>

                {/* User Section - Bottom Pinned */}
                <div className="p-3 border-t border-slate-200 mt-auto bg-slate-50/50 overflow-hidden">
                    <div className={`
                        group flex items-center gap-3 p-2 rounded-xl 
                        hover:bg-white hover:shadow-sm cursor-pointer border border-transparent hover:border-slate-200
                        transition-all duration-200 relative
                        ${isCollapsed ? 'md:justify-center' : ''}
                    `}>
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>

                        {/* User Text: Hidden on Desktop if collapsed */}
                        <div className={`flex-1 overflow-hidden transition-opacity duration-200 min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
                            <p className="text-sm font-bold text-slate-800 truncate">{user?.name || user?.email || 'Admin'}</p>
                            <p className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block flex-shrink-0"></span>
                                <span className="truncate">Online</span>
                            </p>
                        </div>

                        {/* Logout Button (Expanded / Mobile) */}
                        {/* Always show on mobile. On desktop, show if !collapsed. If collapsed desktop, hide (and show bottom button). */}
                        <button
                            onClick={logout}
                            className={`p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ${isCollapsed ? 'md:hidden' : ''}`}
                            title="Sign Out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Collapsed Logout separate button - Desktop Only */}
                    {isCollapsed && (
                        <button
                            onClick={logout}
                            className="hidden md:flex w-full mt-3 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg justify-center transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Inline styles to hide scrollbar */}
                <style jsx>{`
                    nav::-webkit-scrollbar {
                        display: none;
                        width: 0;
                        height: 0;
                    }
                `}</style>
            </nav>
        </>
    );
};

const NavItem = ({ icon, label, active, onClick, collapsed }) => (
    <button
        onClick={onClick}
        title={collapsed ? label : ''}
        className={`
            w-full flex items-center 
            py-2.5 rounded-lg transition-all duration-200 group relative mb-1
            justify-start px-3 gap-3
            ${collapsed ? 'md:justify-center md:px-0 md:gap-0' : ''}
            ${active
                ? 'bg-janmat-blue text-white shadow-md shadow-blue-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
        `}
    >
        <span className={`${active ? 'text-white' : 'text-slate-400 group-hover:text-janmat-blue'} transition-colors flex-shrink-0`}>{icon}</span>

        {/* Text: Visible on Mobile, Hidden on Desktop if collapsed */}
        <span className={`whitespace-nowrap transition-opacity duration-200 font-medium overflow-hidden text-ellipsis ${collapsed ? 'md:hidden' : ''}`}>
            {label}
        </span>

        {/* Tooltip for collapsed state - Desktop Only */}
        {collapsed && (
            <div className="hidden md:block absolute left-full ml-3 px-3 py-1.5 bg-slate-800 text-white text-xs font-medium rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-xl">
                {label}
                {/* Arrow */}
                <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-slate-800"></div>
            </div>
        )}
    </button>
);

export default Sidebar;