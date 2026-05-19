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
    // Only present when the figure is still in the catalog. When set, the
    // footer renders an anchor to /products/<slug>; otherwise the name is
    // rendered as plain text.
    slug?: string;
    name: string;
    line: string;
    price: number; // USD
    imageUrl?: string; // optional, falls back to placeholder tile
  };
  messages: OpinionMessage[];
};

export const OPINIONES: Opinion[] = [
  {
    name: "Ezequiel M.",
    dateLabel: "6 abr 2026",
    product: {
      slug: "ginyu",
      name: "Ginyu",
      line: "S.H.Figuarts",
      price: 100,
      imageUrl:
        "https://idkikvkdijmifaskobeh.supabase.co/storage/v1/object/public/product-images/ginyu/tamashii-1778783147011-50q6na.jpg",
    },
    messages: [
      {
        from: "them",
        text: "Hola Mati! Acabo de retirar a Ginyu.",
        time: "14:12",
      },
      {
        from: "them",
        text: "Genial, muchas gracias 💪",
        time: "14:12",
      },
      {
        from: "me",
        text:
          "Buenísimo! Gracias por la compra, cualquier duda escribime.",
        time: "15:14",
      },
    ],
  },
  {
    name: "Paul M.",
    dateLabel: "3 may 2026",
    product: {
      slug: "griffon-minos-oce",
      name: "Griffon Minos (OCE)",
      line: "Myth Cloth EX",
      price: 240,
      imageUrl:
        "https://idkikvkdijmifaskobeh.supabase.co/storage/v1/object/public/product-images/griffon-minos-oce/1777967129667-ye77oc.jpg",
    },
    messages: [
      {
        from: "them",
        text: "Consulta el Minos OCE, ¿aún lo tenes?",
        time: "11:24",
      },
      {
        from: "me",
        text: "Sí, sellado. Te paso fotos de la caja.",
        time: "11:25",
      },
      {
        from: "me",
        image: "Minos OCE sellado en caja",
        time: "12:00",
      },
      {
        from: "them",
        text: "Dale, quedamos así. Mañana te transfiero.",
        time: "12:17",
      },
    ],
  },
  {
    name: "Maxi T.",
    dateLabel: "8 abr 2026",
    product: {
      // Figure no longer in catalog — render name without a link.
      name: "Goku evento",
      line: "S.H.Figuarts",
      price: 180,
    },
    messages: [
      {
        from: "them",
        text: "Hola Mati! Te paso lo del Goku de evento.",
        time: "11:55",
      },
      {
        from: "me",
        text:
          "Hola Maxi! Son 180 usd. Te lo llevo el 24 cuando viajo a capital.",
        time: "11:56",
      },
      {
        from: "them",
        image: "Comprobante de transferencia",
        time: "12:20",
      },
      {
        from: "me",
        text: "Recibido. Nos vemos el 24.",
        time: "12:21",
      },
    ],
  },
];
