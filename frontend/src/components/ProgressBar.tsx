interface Props {
  value: number   // 0–100
  label?: string
}

export function ProgressBar({ value, label }: Props) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      {label && <span className="progress-label">{label}</span>}
    </div>
  )
}
