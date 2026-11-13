export function MoveButtons({
  action,
  fields,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
}) {
  return (
    <span className="flex items-center gap-1">
      {(["up", "down"] as const).map((direction) => (
        <form action={action} key={direction}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="direction" value={direction} />
          <button
            type="submit"
            className="btn btn-ghost btn-sm"
            aria-label={direction === "up" ? "Mover arriba" : "Mover abajo"}
          >
            {direction === "up" ? "↑" : "↓"}
          </button>
        </form>
      ))}
    </span>
  );
}
