import { useState } from 'react'

interface Props {
  text: string
  children: React.ReactNode
}

export function Tooltip({ text, children }: Props) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="tooltip-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && <span className="tooltip-box">{text}</span>}
    </span>
  )
}
