export function PreviewFrame({
  children,
  label = "MLO",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="preview-frame">
      <div className="preview-frame-top">
        <span className="preview-dot" />
        <span>{label}</span>
      </div>
      <div className="preview-screen">{children}</div>
    </div>
  );
}
