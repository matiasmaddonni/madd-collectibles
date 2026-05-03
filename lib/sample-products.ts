export type Condition = "MISB" | "Loose" | "Used" | "Open Box";
export type ProductStatus = "Disponible" | "Reservado" | "Vendido";
export type Line = "Myth Cloth" | "Myth Cloth EX" | "S.H.Figuarts";
export type CaseGradient = "gold" | "crimson" | "mixed" | "cool";

export type Product = {
  id: string;
  name: string;
  series: string;
  line: Line;
  condition: Condition;
  priceArs: number;
  status: ProductStatus;
  caseGradient: CaseGradient;
};

export const formatArs = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

export const featuredProducts: Product[] = [
  {
    id: "msc-pegasus-v1",
    name: "Pegasus Seiya — V1 Bronze",
    series: "Saint Seiya",
    line: "Myth Cloth EX",
    condition: "MISB",
    priceArs: 185000,
    status: "Disponible",
    caseGradient: "gold",
  },
  {
    id: "shf-goku-ssj",
    name: "Son Goku Super Saiyan",
    series: "Dragon Ball Z",
    line: "S.H.Figuarts",
    condition: "MISB",
    priceArs: 92000,
    status: "Disponible",
    caseGradient: "crimson",
  },
  {
    id: "msc-shiryu-dragon",
    name: "Dragon Shiryu — V2 Bronze",
    series: "Saint Seiya",
    line: "Myth Cloth",
    condition: "Loose",
    priceArs: 74000,
    status: "Reservado",
    caseGradient: "mixed",
  },
  {
    id: "shf-spider-man",
    name: "Spider-Man — Upgraded Suit",
    series: "Marvel",
    line: "S.H.Figuarts",
    condition: "Open Box",
    priceArs: 68000,
    status: "Disponible",
    caseGradient: "cool",
  },
];

export const heroPreviewProducts: Product[] = [
  {
    id: "hero-1",
    name: "Phoenix Ikki — V4 Bronze",
    series: "Saint Seiya",
    line: "Myth Cloth EX",
    condition: "MISB",
    priceArs: 210000,
    status: "Disponible",
    caseGradient: "crimson",
  },
  {
    id: "hero-2",
    name: "Vegeta — Premium Color",
    series: "Dragon Ball Z",
    line: "S.H.Figuarts",
    condition: "MISB",
    priceArs: 105000,
    status: "Disponible",
    caseGradient: "gold",
  },
  {
    id: "hero-3",
    name: "Andromeda Shun — V3",
    series: "Saint Seiya",
    line: "Myth Cloth",
    condition: "Loose",
    priceArs: 82000,
    status: "Vendido",
    caseGradient: "mixed",
  },
];
