// lib/cars.ts — single source of truth for company cars

export const COMPANY_CARS = [
  {
    id: "car-mirage",
    name: "Mitsubishi Mirage",
    short: "Mirage",
    plate: "7 กร 1247",
    color: "#2563eb",      // blue
    colorLight: "#dbeafe",
    imageUrl: "/cars/mirage.png",
  },
  {
    id: "car-carry1",
    name: "Suzuki Carry",
    short: "Carry #1",
    plate: "3 ฒฉ 1209",
    color: "#7c3aed",      // purple
    colorLight: "#ede9fe",
    imageUrl: "/cars/carry1.png",
  },
  {
    id: "car-carry2",
    name: "Suzuki Carry",
    short: "Carry #2",
    plate: "1 ฒต 4165",
    color: "#0891b2",      // cyan
    colorLight: "#cffafe",
    imageUrl: "/cars/carry2.png",
  },
] as const;

export type CarId = (typeof COMPANY_CARS)[number]["id"];