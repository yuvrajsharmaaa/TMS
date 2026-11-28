import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActivityLog } from "../types";
import { formatActivityLogLine } from "../utils";

interface ActivityLogListProps {
    logs: ActivityLog[];
    onAddNote?: (note: string) => void;
    isAddingNote?: boolean;
    canAddNote?: boolean;
    emptyText?: string;
}

/**
 * Displays Activity Log entries newest-first formatted strictly as:
 * "DD.MM.YY: Initials: Note" (Section 8)
 */
export function ActivityLogList({
    logs,
    onAddNote,
    isAddingNote = false,
    canAddNote = true,
    emptyText = "No activity logged yet.",
}: ActivityLogListProps) {
    const [note, setNote] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!note.trim() || !onAddNote) return;
        onAddNote(note.trim());
        setNote("");
    };

    return (
        <div className="rec-activity-log space-y-3">
            {canAddNote && onAddNote && (
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <Input
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="Add an activity log remark..."
                        aria-label="Add activity log remark"
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={!note.trim() || isAddingNote}
                    >
                        <MessageSquarePlus className="mr-1.5 h-4 w-4" />
                        Log Note
                    </Button>
                </form>
            )}

            {logs.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {emptyText}
                </div>
            ) : (
                <ul className="divide-y rounded-md border bg-muted/15 text-sm">
                    {logs.map(log => (
                        <li key={log.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                            <div className="font-mono text-xs leading-relaxed text-foreground sm:text-sm">
                                {formatActivityLogLine(log)}
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">
                                {log.authorName}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
