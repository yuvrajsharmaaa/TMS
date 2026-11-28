import type { ReactNode } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SideDrawerFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    size?: "md" | "lg" | "xl";
}

/**
 * Standardized right-hand side-drawer form container using the shared Sheet primitive (Section 4).
 */
export function SideDrawerForm({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    size = "lg",
}: SideDrawerFormProps) {
    const widthClass =
        size === "xl"
            ? "w-full sm:max-w-2xl"
            : size === "lg"
              ? "w-full sm:max-w-xl"
              : "w-full sm:max-w-lg";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className={cn("rec-side-drawer flex h-full flex-col gap-0 p-0", widthClass)}
            >
                <SheetHeader className="border-b bg-muted/20 px-6 py-4">
                    <SheetTitle className="text-base">{title}</SheetTitle>
                    {description && <SheetDescription>{description}</SheetDescription>}
                </SheetHeader>

                <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-4 pb-4">{children}</div>
                </ScrollArea>

                {footer && (
                    <SheetFooter className="border-t bg-muted/20 px-6 py-3 sm:flex-row sm:justify-end">
                        {footer}
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}
