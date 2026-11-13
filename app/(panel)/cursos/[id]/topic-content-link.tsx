import Link from "next/link";

export function TopicContentLink({
  topicId,
  classId,
}: {
  topicId: string;
  classId: string;
}) {
  return (
    <Link
      href={`/contenido-extra?classId=${encodeURIComponent(classId)}&topicId=${encodeURIComponent(topicId)}`}
      className="btn btn-primary btn-sm"
    >
      Añadir
    </Link>
  );
}
