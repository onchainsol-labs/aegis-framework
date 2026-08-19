/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        envelope: "#E13A2F",
        "envelope-deep": "#B92A21",
        gold: "#F5B842",
        "gold-soft": "#FBE3B3",
        cream: "#FFF7EC",
        ink: "#1F1B16",
        "ink-soft": "#6B6257",
      },
      fontFamily: {
        sans: ["Nunito_400Regular"],
        semibold: ["Nunito_600SemiBold"],
        bold: ["Nunito_700Bold"],
        extrabold: ["Nunito_800ExtraBold"],
        black: ["Nunito_900Black"],
      },
      boxShadow: {
        envelope: "0 16px 40px -16px rgba(225,58,47,0.5)",
        card: "0 10px 30px -12px rgba(31,27,22,0.18)",
        float: "0 12px 28px -8px rgba(225,58,47,0.45)",
      },
    },
  },
  plugins: [],
};
