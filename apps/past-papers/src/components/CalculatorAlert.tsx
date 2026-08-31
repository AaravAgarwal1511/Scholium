import { AlertTriangle } from "lucide-react";

// Some components turned non-calculator with the 2025 syllabus — Additional
// Mathematics (0606) Paper 1, and Mathematics (0580) Paper 2 (the reform split
// 0580 into non-calculator Paper 2 / calculator Paper 4). Shown wherever a user
// generates that component, since pre-2025 papers assume a calculator was
// allowed. `paperLabel` names the affected paper ("Paper 1", "Paper 2").
const WARNING_HSL = "38 95% 50%";

export default function CalculatorAlert({ paperLabel }: { paperLabel: string }) {
  return (
    <div
      className="mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm"
      style={{
        color: `hsl(${WARNING_HSL})`,
        background: `hsl(${WARNING_HSL} / 0.12)`,
        borderColor: `hsl(${WARNING_HSL} / 0.35)`,
      }}
      role="note"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <p className="text-foreground">
        <span className="font-semibold">Calculator notice:</span> calculators were allowed in
        {" "}{paperLabel} for exams before 2025. Questions from those years may assume calculator
        use, which the current non-calculator {paperLabel} format does not allow.
      </p>
    </div>
  );
}
