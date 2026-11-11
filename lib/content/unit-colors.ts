export const UNIT_COLORS = [
  "blue",
  "violet",
  "green",
  "amber",
  "orange",
  "rose",
  "teal",
] as const;

export type UnitColor = (typeof UNIT_COLORS)[number];

export const UNIT_COLOR_LABELS: Record<UnitColor, string> = {
  blue: "Azul",
  violet: "Violeta",
  green: "Verde",
  amber: "Ámbar",
  orange: "Naranja",
  rose: "Rosa",
  teal: "Turquesa",
};
