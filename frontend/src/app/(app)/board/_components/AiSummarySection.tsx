"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { fetchSummary } from "@/lib/api/ai";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { cn } from "@/lib/utils";

interface AiSummarySectionProps {
  ticketId: string;
}

export function AiSummarySection({ ticketId }: AiSummarySectionProps) {
  const aiEnabled = useAiEnabled();
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();

  const summaryMutation = useMutation({
    mutationFn: () => fetchSummary(ticketId),
    onSuccess: (data) => {
      setSummary(data.summary);
      setIsOpen(true);
    },
    onError: (err) => {
      toast({
        title: "AI request failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Hide entirely when AI is disabled (AI-07 / feature flag UX)
  if (!aiEnabled) return null;

  return (
    <div className="border-t border-slate-100 pt-4 space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          Progress Summary
        </button>
        <button
          onClick={() => summaryMutation.mutate()}
          disabled={summaryMutation.isPending}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          {summaryMutation.isPending ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Summarizing…</>
          ) : (
            <><Sparkles className="h-3 w-3" /> Summarize progress</>
          )}
        </button>
      </div>

      {/* Summary text — independent of isOpen state to survive collapse/expand */}
      {isOpen && (
        <div className={cn("text-sm text-slate-600 leading-relaxed pl-5")}>
          {summary ? (
            <p>{summary}</p>
          ) : (
            <p className="text-slate-400 italic">
              Click &ldquo;Summarize progress&rdquo; to generate an AI summary of comments, subtasks, and activity.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
