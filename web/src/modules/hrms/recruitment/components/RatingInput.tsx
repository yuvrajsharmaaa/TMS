import { StarRatingInput } from "@/components/StarRatingInput";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface RatingInputProps {
    id?: string;
    label?: string;
    value: number | null;
    onChange?: (next: number) => void;
    readonly?: boolean;
    required?: boolean;
    helperText?: string;
    className?: string;
}

/**
 * Accessible 1–5 rating input wrapping the shared StarRatingInput with keyboard-friendly numeric buttons (Section 3 & 4).
 */
export function RatingInput({
    id,
    label,
    value,
    onChange,
    readonly = false,
    required = false,
    helperText,
    className,
}: RatingInputProps) {
    return (
        <div className={cn("rec-rating-input space-y-1.5", className)}>
            {label && (
                <div className="flex items-center justify-between">
                    <Label htmlFor={id} className="text-sm font-medium">
                        {label} {required && <span className="text-destructive">*</span>}
                    </Label>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {value ? `${value} / 5` : "Not rated"}
                    </span>
                </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
                <StarRatingInput
                    value={value}
                    onChange={v => {
                        if (!readonly && onChange && v !== null) {
                            onChange(v);
                        }
                    }}
                    max={5}
                    size="md"
                    readonly={readonly}
                />
                <div className="flex items-center gap-1" role="radiogroup" aria-label={label || "Rating 1 to 5"}>
                    {[1, 2, 3, 4, 5].map(score => {
                        const isSelected = value === score;
                        return (
                            <button
                                key={score}
                                type="button"
                                disabled={readonly}
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Rate ${score} out of 5`}
                                onClick={() => !readonly && onChange?.(score)}
                                className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded border text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    isSelected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-foreground hover:bg-muted",
                                    readonly && "cursor-default opacity-60"
                                )}
                            >
                                {score}
                            </button>
                        );
                    })}
                </div>
            </div>
            {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
    );
}
