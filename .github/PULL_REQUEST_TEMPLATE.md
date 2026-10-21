name: Pull request
description: Propose a change to ThermoLab.
labels: ["change"]
body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What does this PR change and why?
    validations:
      required: true
  - type: textarea
    id: model-impact
    attributes:
      label: Impact on the calculation model
      description: >
        Does this change the equations, the validation rules, or the stated
        assumptions? If so, list the before/after behaviour and update the
        README accordingly.
  - type: checkboxes
    id: checks
    attributes:
      label: Checklist
      options:
        - label: npm run lint passes
          required: true
        - label: npm run typecheck passes
          required: true
        - label: npm test passes, and new behaviour is covered by tests
          required: true
        - label: npm run build passes
          required: true
        - label: I updated the README if the model, assumptions, or usage changed
