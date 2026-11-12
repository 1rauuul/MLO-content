"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AssignedGroup = { id: string; name: string };

export function TopicContentLink({
  topicId,
  groups,
}: {
  topicId: string;
  groups: AssignedGroup[];
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const href = useMemo(
    () =>
      groupId
        ? `/contenido-extra?classId=${encodeURIComponent(groupId)}&topicId=${encodeURIComponent(topicId)}`
        : "/grupos",
    [groupId, topicId],
  );

  if (groups.length === 0) return null;

  if (groups.length === 1) {
    return (
      <Link href={href} className="btn btn-primary btn-sm">
        Añadir
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`group-${topicId}`}>
        Grupo para el contenido
      </label>
      <select
        id={`group-${topicId}`}
        value={groupId}
        onChange={(event) => setGroupId(event.target.value)}
        className="field h-8 max-w-40 py-1 text-xs"
      >
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <Link href={href} className="btn btn-primary btn-sm">
        Añadir
      </Link>
    </span>
  );
}
