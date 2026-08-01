import { AlertTriangle } from "lucide-react";

// Additional Mathematics (0606) switched Paper 1 to non-calculator starting
// with the 2025 syllabus. Shown wherever a user browses or generates Add
// Math Paper 1 content, since pre-2025 papers assume a calculator was allowed.
const WARNING_HSL = "38 95% 50%";

export default function CalculatorAlert() {
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
        Paper 1 for exams before 2025. Questions from those years may assume calculator use, which
        the current non-calculator Paper 1 format does not allow.
      </p>
    </div>
  );
}
