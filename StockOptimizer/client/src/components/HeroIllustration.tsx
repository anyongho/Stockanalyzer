import React from "react";

export function HeroIllustration({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 400 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E0F2FE" />
                    <stop offset="100%" stopColor="#BAE6FD" />
                </linearGradient>
                <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F0F9FF" />
                    <stop offset="100%" stopColor="#E0F2FE" />
                </linearGradient>
                <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.1" />
                </filter>
            </defs>

            {/* Background Blob */}
            <path
                d="M50 150 C 50 50, 150 50, 200 100 C 250 50, 350 50, 350 150 C 350 250, 250 250, 200 200 C 150 250, 50 250, 50 150 Z"
                fill="url(#grad1)"
                opacity="0.5"
            />

            {/* Chart Background */}
            <rect x="80" y="80" width="240" height="160" rx="12" fill="white" filter="url(#shadow)" />

            {/* Chart Lines */}
            <path
                d="M100 200 L 140 180 L 180 210 L 220 160 L 260 170 L 300 120"
                stroke="#0EA5E9"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />

            {/* Area under chart */}
            <path
                d="M100 200 L 140 180 L 180 210 L 220 160 L 260 170 L 300 120 V 220 H 100 Z"
                fill="url(#grad2)"
                opacity="0.6"
            />

            {/* Coins/Bubbles */}
            <circle cx="300" cy="120" r="8" fill="#FCD34D" />
            <circle cx="220" cy="160" r="6" fill="#FCD34D" />
            <circle cx="260" cy="170" r="5" fill="#FCD34D" />

            {/* Character/Person (Abstract) */}
            <circle cx="140" cy="260" r="20" fill="#38BDF8" />
            <path d="M120 300 Q 140 280 160 300" stroke="#38BDF8" strokeWidth="20" strokeLinecap="round" />

            {/* Plant (Growth symbol) */}
            <path d="M340 260 Q 340 220 320 200" stroke="#22C55E" strokeWidth="4" strokeLinecap="round" />
            <path d="M340 260 Q 340 230 360 210" stroke="#22C55E" strokeWidth="4" strokeLinecap="round" />
            <path d="M320 200 A 10 10 0 0 1 330 190" fill="#4ADE80" />
            <path d="M360 210 A 10 10 0 0 0 350 200" fill="#4ADE80" />
            <rect x="330" y="260" width="20" height="20" rx="2" fill="#78350F" />

        </svg>
    );
}
