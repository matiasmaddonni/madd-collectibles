// Testimonial seeds for the home-page Opiniones rail. Real conversations get
// pasted in here once cleared with the buyers. JSX never hardcodes content —
// edit this file to change copy, dates, products, etc.

export type OpinionMessage = {
  from: "them" | "me";
  text?: string;
  // Caption/alt for the image placeholder. The placeholder tile renders if
  // `image` is set; replace with a real cropped screenshot later.
  image?: string;
  time: string; // "14:02"
};

export type Opinion = {
  // Public-safe display name: first name + last initial, e.g. "Ezequiel R."
  name: string;
  // Optional handle (Instagram etc) — not rendered in v1.
  handle?: string;
  // Date pill text inside the chat body, e.g. "12 abr 2026".
  dateLabel: string;
  product: {
    slug: string; // links to /products/<slug>
    name: string;
    line: string;
    price: number; // USD
    imageUrl?: string; // optional, falls back to placeholder tile
  };
  messages: OpinionMessage[];
};

export const OPINIONES: Opinion[] = [
  {
    name: "Ezequiel R.",
    dateLabel: "12 abr 2026",
    product: {
      slug: "ginyu",
      name: "Ginyu",
      line: "S.H.Figuarts",
      price: 100,
    },
    messages: [
      {
        from: "them",
        text: "Hola Matias! Me interesa el Ginyu. ¿Sigue disponible?",
        time: "14:02",
      },
      {
        from: "me",
        text: "Hola! Sí, queda uno sellado. Te paso fotos reales.",
        time: "14:03",
      },
      {
        from: "me",
        image: "Ginyu sellado, fotos reales",
        time: "14:03",
      },
      {
        from: "them",
        text: "Lo llevo. Coordinamos envío a Córdoba?",
        time: "14:08",
      },
    ],
  },
  {
    name: "Lucía M.",
    dateLabel: "28 mar 2026",
    product: {
      slug: "centaurus-babel",
      name: "Babel de Centaurus",
      line: "Saint Cloth Myth",
      price: 200,
    },
    messages: [
      {
        from: "them",
        text:
          "Hola! Vi la página, ¿el Babel de Centaurus está en condición sellado?",
        time: "10:14",
      },
      {
        from: "me",
        text:
          "Sí, sellado original Bandai. Te mando foto del precinto y la caja.",
        time: "10:16",
      },
      {
        from: "me",
        image: "Caja sellada con precinto Bandai",
        time: "10:16",
      },
      {
        from: "them",
        text: "Espectacular. Lo reservo, te transfiero ahora.",
        time: "10:20",
      },
    ],
  },
  {
    name: "Martín P.",
    dateLabel: "15 mar 2026",
    product: {
      slug: "frieza",
      name: "Frieza",
      line: "S.H.Figuarts",
      price: 75,
    },
    messages: [
      {
        from: "them",
        text:
          "Hola! Buscaba el Frieza desde hace un montón. ¿Tenés stock?",
        time: "19:41",
      },
      {
        from: "me",
        text: "Sí, sellado. ¿Te lo dejo apartado mientras coordinamos?",
        time: "19:42",
      },
      {
        from: "them",
        text: "Sí porfa! Mañana paso por el correo.",
        time: "19:43",
      },
    ],
  },
];
