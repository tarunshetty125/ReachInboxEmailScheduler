export function AppleLoader({ label = 'Loading' }: { label?: string }): JSX.Element {
  return (
    <div className="apple-loader" role="status" aria-label={label}>
      {Array.from({ length: 12 }, (_, index) => (
        <span
          key={index}
          className="apple-loader-spoke"
          style={{ transform: `rotate(${index * 30}deg)`, animationDelay: `${index * -0.1}s` }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
