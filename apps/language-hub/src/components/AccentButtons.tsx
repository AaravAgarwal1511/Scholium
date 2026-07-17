import { RefObject } from "react";
import { Button } from "@/components/ui/button";

const FRENCH_ACCENTS = ["à", "â", "ä", "æ", "ç", "è", "é", "ê", "ë", "î", "ï", "ô", "œ", "ù", "û", "ü", "ÿ"];
const SPANISH_ACCENTS = ["á", "é", "í", "ó", "ú", "ü", "ñ", "¿", "¡"];

interface AccentButtonsProps {
  inputRef: RefObject<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  language?: string;
  disabled?: boolean;
}

export const AccentButtons = ({ inputRef, value, onChange, language, disabled }: AccentButtonsProps) => {
  const accents = language === "spanish" ? SPANISH_ACCENTS : FRENCH_ACCENTS;

  const insertAccent = (char: string) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const newValue = value.slice(0, start) + char + value.slice(end);
    onChange(newValue);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + char.length, start + char.length);
    });
  };

  return (
    <div className="flex flex-nowrap gap-1 justify-center overflow-x-auto">
      {accents.map((char) => (
        <Button
          key={char}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => insertAccent(char)}
          disabled={disabled}
          // Out of the tab order: these are a pointer shortcut for characters the
          // keyboard can already type, so Tab should reach the next field instead.
          tabIndex={-1}
          className="h-8 w-8 p-0 text-sm font-serif"
        >
          {char}
        </Button>
      ))}
    </div>
  );
};
