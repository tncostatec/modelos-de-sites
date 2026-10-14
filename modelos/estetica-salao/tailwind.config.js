/** Tailwind compilado localmente (não o CDN de desenvolvimento).
 *  Gera assets/css/styles.css a partir de assets/css/tailwind.css — comando no README. */
module.exports = {
  content: ["./index.html", "./assets/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        // rosé: superfícies e acentos. 700/800 são os únicos tons seguros para texto sobre fundos claros.
        rose: {
          50: "#FBF3F1", 100: "#F6E4E0", 200: "#F1D8D2", 300: "#E6BDB5", 400: "#D9A39A",
          500: "#C98B81", 600: "#B0695F", 700: "#9E5C53", 800: "#8A4E46", 900: "#5E332E"
        },
        // areia: faixas de fundo, "tiles" e detalhes quentes
        areia: { 50: "#FAF7F1", 100: "#F5EFE6", 200: "#EADFCF", 300: "#DCCCB2", 400: "#C9B79C", 500: "#A8946F" },
        // grafite: texto, botões principais e o preto "quente" do rodapé
        grafite: { 50: "#F4F4F6", 200: "#DCDCE1", 300: "#B8B8C0", 500: "#6B6B75", 700: "#45454D", 900: "#26262B", 950: "#19191D" }
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", '"Times New Roman"', "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", '"Helvetica Neue"', "Arial", "sans-serif"]
      },
      maxWidth: { site: "76rem" },
      boxShadow: {
        tile: "0 1px 2px rgb(38 38 43 / 0.05), 0 24px 48px -24px rgb(38 38 43 / 0.28)",
        suave: "0 1px 0 rgb(38 38 43 / 0.04), 0 10px 30px -16px rgb(38 38 43 / 0.18)"
      },
      keyframes: {
        surgir: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "none" } }
      },
      animation: { surgir: "surgir 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both" }
    }
  },
  plugins: []
};
