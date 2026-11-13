export type StudioTopic = {
  id: string;
  title: string;
  unitId: string;
  unitNumber: number;
  unitTitle: string;
};

export type StudioGroup = {
  id: string;
  name: string;
  /** Curso propio del grupo, donde se guarda el contenido. */
  courseId: string | null;
  /** Curso que se muestra y cuyos subtemas se usan como destino. */
  sourceCourseId: string | null;
  courseTitle: string | null;
  topics: StudioTopic[];
};

export type StudioContentType = "lesson" | "example" | "exercise" | "evaluation";
