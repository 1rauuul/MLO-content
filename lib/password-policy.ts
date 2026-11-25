export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordRequirementId =
  | "length"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special";

export interface PasswordRequirement {
  id: PasswordRequirementId;
  label: string;
  test: (value: string) => boolean;
}

const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/;

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: `Entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres`,
    test: (value) =>
      value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
  },
  { id: "uppercase", label: "Una mayúscula", test: (value) => /[A-Z]/.test(value) },
  { id: "lowercase", label: "Una minúscula", test: (value) => /[a-z]/.test(value) },
  { id: "number", label: "Un número", test: (value) => /[0-9]/.test(value) },
  { id: "special", label: "Un carácter especial", test: (value) => SPECIAL.test(value) },
];

export function validatePassword(value: string): {
  valid: boolean;
  unmet: PasswordRequirementId[];
} {
  const unmet = PASSWORD_REQUIREMENTS.filter(
    (requirement) => !requirement.test(value),
  ).map((requirement) => requirement.id);
  return { valid: unmet.length === 0, unmet };
}
