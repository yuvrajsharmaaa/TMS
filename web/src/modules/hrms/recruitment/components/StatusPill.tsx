import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusPillProps {
    status: string | null | undefined;
    className?: string;
}

/**
 * Semantic status pill reusing the existing Badge component and semantic tokens (Section 4).
 */
export function StatusPill({ status, className }: StatusPillProps) {
    if (!status) return <span className="text-muted-foreground">—</span>;

    const normalized = status.trim().toLowerCase();

    let variant: "default" | "secondary" | "destructive" | "outline" = "outline";

    if (
        normalized === "active" ||
        normalized === "finalized" ||
        normalized === "done" ||
        normalized === "joined" ||
        normalized === "selected" ||
        normalized === "selected for director interview" ||
        normalized === "shortlisted" ||
        normalized === "pruning cleared" ||
        normalized === "interested" ||
        normalized === "offer released" ||
        normalized === "accepted" ||
        normalized === "paid" ||
        normalized === "approved" ||
        normalized === "completed"
    ) {
        variant = "secondary";
    } else if (
        normalized === "rejected" ||
        normalized === "pruning rejected" ||
        normalized === "not interested" ||
        normalized === "perpetually not reachable" ||
        normalized === "did not join" ||
        normalized === "offer declined" ||
        normalized === "cancelled" ||
        normalized === "no show" ||
        normalized === "not started"
    ) {
        variant = "destructive";
    } else if (
        normalized === "filled" ||
        normalized === "position closed"
    ) {
        variant = "default";
    } else {
        // On Hold, In Progress, Call Back, Semi Interested, Not Reachable, Scheduled, Rescheduled, Pending, Deferred Joining
        variant = "outline";
    }

    return (
        <Badge variant={variant} className={cn("rec-status-pill whitespace-nowrap", className)}>
            {status}
        </Badge>
    );
}
