/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                janmat: {
                    blue: '#0B3D91',
                    hover: '#092C6B',
                    light: '#E7F1FF',
                },
            },
            fontFamily: {
                sans: ['"Public Sans"', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
