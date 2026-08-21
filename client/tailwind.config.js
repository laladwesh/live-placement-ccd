/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary:       "#14213D",   // oxford ink-blue (matches placement portal)
        primaryHover:  "#1C2C4F",
        primaryActive: "#0B1526",
        accent:        "#7C2D3E",   // muted burgundy accent (matches placement portal)

        // Override slate scale → placement portal gray palette
        slate: {
          50:  "#F4F2F1",   // page background (warm off-white, matches portal)
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

        // indigo → same oxford blue (so any indigo-* classes match the theme)
        indigo: {
          50:  "#F1EDEA",
          100: "#E9E2DF",
          200: "#C9C0BC",
          300: "#9E918A",
          400: "#6B5D56",
          500: "#3A3028",
          600: "#14213D",
          700: "#1C2C4F",
          800: "#0B1526",
          900: "#06090F",
          950: "#020305",
        },

        // Override blue → oxford blue scale (matches placement portal)
        blue: {
          50:  "#F1EDEA",   // tint hover (warm off-white tint)
          100: "#E9E2DF",   // tint active
          200: "#C9C0BC",
          300: "#9E918A",
          400: "#6B5D56",
          500: "#3A3028",
          600: "#14213D",   // oxford primary
          700: "#1C2C4F",   // hover
          800: "#0B1526",   // active
          900: "#06090F",
          950: "#020305",
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
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
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
