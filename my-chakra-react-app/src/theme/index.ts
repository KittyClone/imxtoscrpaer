import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  colors: {
    brand: {
      50: "#f5e8ff",
      100: "#e0c3ff",
      200: "#c69bff",
      300: "#b06eff",
      400: "#9b4eff",
      500: "#7a2bff",
      600: "#5a1aff",
      700: "#3b0eff",
      800: "#1d00e6",
      900: "#0000b3",
    },
  },
  fonts: {
    heading: "'Poppins', sans-serif",
    body: "'Poppins', sans-serif",
  },
  styles: {
    global: {
      body: {
        bg: "brand.50",
        color: "brand.900",
      },
    },
  },
});

export default theme;