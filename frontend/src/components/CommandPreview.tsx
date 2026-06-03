import type { PreviewStep, StepResult } from '../api'

interface Props {
  steps: PreviewStep[] | StepResult[]
  ran?: boolean
}

function isResult(s: PreviewStep | StepResult): s is StepResult {
  return 'success' in s
}

export function CommandPreview({ steps, ran = false }: Props) {
  if (steps.length === 0) return null
  return (
    <div className="cmd-preview">
      <div className="cmd-preview-header">
        {ran ? 'Execution Results' : 'Commands to Run'} ({steps.length} steps)
      </div>
      {steps.map((step, i) => (
        <div key={i} className={`cmd-step ${ran && isResult(step) ? (step.success ? 'cmd-ok' : 'cmd-fail') : ''}`}>
          <div className="cmd-step-header">
            {ran && isResult(step) && (
              <span className={`cmd-badge ${step.success ? 'cmd-badge-ok' : 'cmd-badge-fail'}`}>
                {step.success ? '✓' : '✗'}
              </span>
            )}
            <span className="cmd-step-name">{i + 1}. {step.name}</span>
          </div>
          <code className="cmd-text">{step.command}</code>
          {ran && isResult(step) && !step.success && step.stderr && (
            <div className="cmd-error">{step.stderr}</div>
          )}
          {ran && isResult(step) && step.success && step.stdout && (
            <div className="cmd-output">{step.stdout}</div>
          )}
        </div>
      ))}
    </div>
  )
}
