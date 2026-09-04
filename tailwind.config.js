/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./index.tsx",
        "./App.tsx",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./hooks/**/*.{js,ts,jsx,tsx}",
        "./store/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['Vazirmatn', 'sans-serif'],
            },
            colors: {
                primary: '#0f172a', // Slate 900
                secondary: '#64748b', // Slate 500
                accent: '#0ea5e9', // Sky 500
                dark: '#000000', // Pure Black
                surface: '#050505', // Almost Black
            },
            animation: {
                'gradient-xy': 'gradient-xy 6s ease infinite',
                'breathe': 'breathe 1s ease-in-out infinite',
                'window-open': 'window-open 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                'modal-open': 'modal-open 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                'fullscreen-open': 'fullscreen-open 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                'slide-up-fade': 'slide-up-fade 0.3s ease-out',
                'fade-in': 'fade-in 0.15s ease-out',
                'pop-in': 'pop-in 0.2s ease-out',
                'pulse-border': 'pulse-border 2s ease-in-out infinite',
                'fade-in-delay': 'fade-in-delay 0.5s ease-out 0.3s both',
                'drawer-down': 'drawer-down 0.18s cubic-bezier(0.32, 0.72, 0, 1)',
                'drawer-up': 'drawer-up 0.18s cubic-bezier(0.32, 0.72, 0, 1)',
                'card-sink': 'card-sink 0.45s cubic-bezier(0.55, 0, 0.55, 0.2) both',
                'brand-drop': 'brand-drop 0.75s cubic-bezier(0.34, 1.4, 0.64, 1) both',
                'rule-expand': 'rule-expand 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both',
                'welcome-rise': 'welcome-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.85s both',
                'ambient-glow': 'ambient-glow 3.5s ease-in-out infinite',
                'intro-out': 'intro-out 0.45s cubic-bezier(0.55, 0, 0.55, 0.2) both',
            },
            keyframes: {
                'gradient-xy': {
                    '0%, 100%': {
                        'background-size': '200% 200%',
                        'background-position': 'left center'
                    },
                    '50%': {
                        'background-size': '200% 200%',
                        'background-position': 'right center'
                    },
                },
                'breathe': {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.95' },
                    '50%': { transform: 'scale(1.01)', opacity: '1' },
                },
                'window-open': {
                    '0%': {
                        opacity: '0',
                        transform: 'translate(-50%, -50%) scale(0.96)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translate(-50%, -50%) scale(1)'
                    },
                },
                'modal-open': {
                    '0%': {
                        opacity: '0',
                        transform: 'scale(0.97) translateY(4px)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'scale(1) translateY(0)'
                    },
                },
                'fullscreen-open': {
                    '0%': {
                        opacity: '0',
                        transform: 'scale(0.99)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'scale(1)'
                    },
                },
                'slide-up-fade': {
                    '0%': {
                        opacity: '0',
                        transform: 'translateY(10px)'
                    },
                    '100%': {
                        opacity: '1',
                        transform: 'translateY(0)'
                    },
                },
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'pop-in': {
                    '0%': { 
                        opacity: '0',
                        transform: 'scale(0.95)'
                    },
                    '100%': { 
                        opacity: '1',
                        transform: 'scale(1)'
                    },
                },
                'pulse-border': {
                    '0%, 100%': { 
                        opacity: '1',
                        transform: 'scale(1)'
                    },
                    '50%': { 
                        opacity: '0.5',
                        transform: 'scale(1.05)'
                    },
                },
                'fade-in-delay': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'drawer-down': {
                    '0%': { opacity: '0', transform: 'scaleY(0.85) translateY(-4px)' },
                    '100%': { opacity: '1', transform: 'scaleY(1) translateY(0)' },
                },
                'drawer-up': {
                    '0%': { opacity: '0', transform: 'scaleY(0.85) translateY(4px)' },
                    '100%': { opacity: '1', transform: 'scaleY(1) translateY(0)' },
                },
                'card-sink': {
                    '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
                    '100%': { opacity: '0', transform: 'scale(0.9) translateY(90px)' },
                },
                'brand-drop': {
                    '0%': { opacity: '0', transform: 'translateY(-140px) scale(0.45)' },
                    '60%': { opacity: '1', transform: 'translateY(10px) scale(1.08)' },
                    '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
                },
                'rule-expand': {
                    '0%': { opacity: '0', transform: 'scaleX(0)' },
                    '100%': { opacity: '1', transform: 'scaleX(1)' },
                },
                'welcome-rise': {
                    '0%': { opacity: '0', transform: 'translateY(18px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'ambient-glow': {
                    '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
                    '50%': { opacity: '0.9', transform: 'scale(1.12)' },
                },
                'intro-out': {
                    '0%': { opacity: '1', transform: 'scale(1)' },
                    '100%': { opacity: '0', transform: 'scale(1.04)' },
                },
            }
        },
    },
    plugins: [],
}
