/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#2164E8",
        accent: "#00CC52",

        // Override slate scale → placement portal gray palette
        slate: {
          50:  "#EEF1F4",   // page background
          100: "#EDEEF0",   // table header / section bg
          200: "#E9E9EB",   // borders / dividers
          300: "#DBDDE0",   // hover borders
          400: "#BCBEC2",   // disabled icons / placeholder
          500: "#8D9096",   // subtle / secondary text
          600: "#494D57",   // table content / muted text
          700: "#353B47",   // body text
          800: "#1E2532",   // headings
          900: "#1B212D",   // dark headings
          950: "#0F1420",
        },

        // Override blue → portal primary blue
        blue: {
          50:  "#EFF6FC",   // light info background
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2164E8",   // portal primary button
          700: "#1A52C4",   // button hover
          800: "#1E40AF",
          900: "#1E3A8A",
          950: "#172554",
        },

        // Override green → portal success green
        green: {
          50:  "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E",
          600: "#107C10",   // portal success
          700: "#0D6910",
          800: "#107C10",   // text on light badge
          900: "#14532D",
          950: "#052E16",
        },

        // Override red → portal error red
        red: {
          50:  "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444",
          600: "#D83B01",   // portal error
          700: "#C03200",
          800: "#D83B01",   // text on light badge
          900: "#7F1D1D",
          950: "#450A0A",
        },
      },

      fontFamily: {
        sans: ["Lato", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },

      // Portal card/table shadows
      boxShadow: {
        sm:      "0px 0.3px 0.9px rgba(27,33,45,0.10), 0px 1.6px 3.6px rgba(27,33,45,0.13)",
        DEFAULT: "0px 0.3px 0.9px rgba(27,33,45,0.10), 0px 1.6px 3.6px rgba(27,33,45,0.13)",
        md:      "0px 1px 3px rgba(27,33,45,0.12), 0px 3px 7px rgba(27,33,45,0.15)",
        lg:      "0px 2px 6px rgba(27,33,45,0.12), 0px 5px 15px rgba(27,33,45,0.15)",
      },

      // Portal button / card border radius (boxy style)
      borderRadius: {
        sm:      "2px",
        DEFAULT: "2px",
        md:      "4px",
        lg:      "4px",
        xl:      "6px",
        "2xl":   "8px",
        "3xl":   "12px",
        full:    "9999px",
      },
    }
  },
  plugins: []
};
