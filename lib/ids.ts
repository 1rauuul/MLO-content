import { randomBytes } from "node:crypto";

// Sin 0, 1, i, l ni o: se leen y se dictan sin ambigüedad.
const COURSE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const JOIN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomFrom(alphabet: string, size: number): string {
  const bytes = randomBytes(size);
  let value = "";
  for (let index = 0; index < size; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }
  return value;
}

export function newCourseKey(): string {
  return randomFrom(COURSE_ALPHABET, 5);
}

export function newJoinCode(): string {
  return randomFrom(JOIN_ALPHABET, 6);
}
