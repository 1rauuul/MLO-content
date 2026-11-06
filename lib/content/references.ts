import type { CoreReference } from "./model";

/** DOI normalizado sin prefijo de resolución. */
export function normalizedDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
}

/** Enlace preferente de la referencia: DOI canónico o URL textual. */
export function referenceUrl(reference: CoreReference): string {
  const doi = normalizedDoi(reference.doi);
  if (doi) return `https://doi.org/${doi}`;
  return reference.url.trim();
}

function endingPeriod(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** APA 7 usa «&» delante del último autor y coma en los demás. */
export function apa7Authors(authors: string[]): string {
  const list = authors.map((author) => author.trim()).filter(Boolean).map(endingPeriod);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}, & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
}

/**
 * Texto APA 7 a partir de los metadatos. Sin año se usa «s. f.»; sin autores
 * el título pasa al inicio, como pide APA. No incluye formato enriquecido.
 */
export function apa7Text(reference: CoreReference): string {
  const title = reference.title.trim().replace(/\.$/, "");
  const edition = reference.edition.trim();
  const titleWithEdition = edition ? `${title} (${edition})` : title;
  const authors = apa7Authors(reference.authors);
  const year = reference.year === null ? "s. f." : String(reference.year);
  const parts = [
    authors ? `${authors} (${year}).` : `${titleWithEdition}. (${year}).`,
  ];

  if (authors) parts.push(endingPeriod(titleWithEdition));
  if (reference.source.trim()) parts.push(endingPeriod(reference.source));
  const url = referenceUrl(reference);
  if (url) parts.push(url);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
