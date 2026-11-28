import Image from "next/image";

import {
  COURSE_ICONS,
  DEFAULT_COURSE_ICON,
  type CourseIconKey,
} from "@/lib/content/course-icons";

const ICON_BY_KEY = new Map(COURSE_ICONS.map((icon) => [icon.key, icon]));

function svgFor(key: CourseIconKey) {
  switch (key) {
    case "module":
      return (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </>
      );
    case "tile":
      return (
        <>
          <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
        </>
      );
    case "database":
      return (
        <>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
          <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
      );
    case "lesson":
      return (
        <>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
          <path d="M14 2v5h5" />
          <path d="M9 12h6M9 16h6" />
        </>
      );
    case "examples":
      return (
        <>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </>
      );
    case "exercises":
      return (
        <>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="m4.5 5 1.5 1.5L8.5 3.5" />
          <path d="m4.5 11 1.5 1.5L8.5 9.5" />
          <path d="m4.5 17 1.5 1.5L8.5 15.5" />
        </>
      );
    case "eval":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6.5V12l3.5 2" />
        </>
      );
    case "info":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </>
      );
    case "user":
      return (
        <>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
        </>
      );
    case "home":
      return (
        <>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </>
      );
    case "algorithm":
      return (
        <>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="6" r="2.5" />
          <circle cx="12" cy="18" r="2.5" />
          <path d="M8.5 6h7M7.2 8.2l3.6 7.6M16.8 8.2l-3.6 7.6" />
        </>
      );
    case "math":
      return <path d="M18 5H7l5.5 7L7 19h11" />;
    case "security":
      return (
        <>
          <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
    case "graphics":
      return (
        <>
          <path d="M4 18c4-9 8-13 16-13" />
          <circle cx="4" cy="18" r="2" />
          <circle cx="20" cy="5" r="2" />
          <path d="M6 20h14" />
        </>
      );
    case "mobile":
      return (
        <>
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
          <path d="M10.5 5h3M11 18.5h2" />
        </>
      );
    case "cloud":
      return (
        <path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6-1.4A4.5 4.5 0 0 1 18 18H7Z" />
      );
    case "chip":
      return (
        <>
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <rect x="10.5" y="10.5" width="3" height="3" rx=".5" />
          <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
        </>
      );
    case "nlp":
      return (
        <>
          <path d="M21 12a8 8 0 0 1-8 8H6l-3 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
          <path d="M8 11h8M8 15h5" />
        </>
      );
    case "robot":
      return (
        <>
          <rect x="4" y="8" width="16" height="11" rx="3" />
          <path d="M12 8V4M8 4h8" />
          <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
          <path d="M9 16h6" />
        </>
      );
    case "game":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
        </>
      );
    case "chart":
      return (
        <>
          <path d="M4 20V4M4 20h16" />
          <path d="M8 16v-4M12 16V8M16 16v-6M20 16V6" />
        </>
      );
  }
}

export function CourseIcon({
  name,
  className = "size-5",
}: {
  name?: string | null;
  className?: string;
}) {
  const key = (name ?? DEFAULT_COURSE_ICON) as CourseIconKey;
  const icon = ICON_BY_KEY.get(key) ?? ICON_BY_KEY.get(DEFAULT_COURSE_ICON)!;

  if (icon.kind === "image") {
    const src = `/course-icons/${icon.key}.png`;
    if ("tone" in icon && icon.tone === "line") {
      return (
        <span
          aria-hidden="true"
          className={`${className} inline-block`}
          style={{
            backgroundColor: "currentColor",
            WebkitMaskImage: `url(${src})`,
            WebkitMaskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskImage: `url(${src})`,
            maskPosition: "center",
            maskRepeat: "no-repeat",
            maskSize: "contain",
          }}
        />
      );
    }
    return (
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        className={`${className} object-contain`}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {svgFor(icon.key)}
    </svg>
  );
}
