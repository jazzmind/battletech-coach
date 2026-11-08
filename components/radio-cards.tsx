"use client"

export function RadioCards<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string
  name: string
  value: T
  onChange: (value: T) => void
  options: { value: T; title: string; subtitle?: string; image?: string }[]
}) {
  return (
    <fieldset className="radio-cards">
      <legend>{legend}</legend>
      <div className={`radio-grid${options.some((option) => option.image) ? " has-art" : ""}`}>
        {options.map((option) => (
          <label key={option.value} className={value === option.value ? "picked" : ""}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.image ? <img src={option.image} alt="" /> : null}
            <span>
              <strong>{option.title}</strong>
              {option.subtitle ? <small>{option.subtitle}</small> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
