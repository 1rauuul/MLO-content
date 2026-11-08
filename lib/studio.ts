export type StudioLesson = {
  id: string;
  code: string;
  title: string;
};

export type StudioTopic = {
  id: string;
  title: string;
  unitNumber: number;
  unitTitle: string;
  lessons: StudioLesson[];
  exampleCount: number;
  exerciseCount: number;
  evaluationCount: number;
};

export type StudioGroup = {
  id: string;
  name: string;
  courseId: string | null;
  courseTitle: string | null;
  topics: StudioTopic[];
};

export type StudioContentType = "lesson" | "example" | "exercise" | "evaluation";
