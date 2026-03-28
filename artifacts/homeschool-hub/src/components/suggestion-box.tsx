import { useState } from "react";
import { Lightbulb, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function SuggestionBox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const MAX = 1000;
  const remaining = MAX - text.length;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }

      toast({ title: "Thanks for the suggestion!", description: "We'll take a look." });
      setText("");
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Submit a suggestion"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 font-semibold text-sm"
      >
        <Lightbulb className="w-4 h-4" />
        <span>Suggest</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Modal */}
          <div className="w-full max-w-md bg-card rounded-3xl border border-border/60 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-base leading-tight">Got an idea?</h2>
                  <p className="text-xs text-muted-foreground">We'd love to hear it</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 pb-6 space-y-4">
              <div className="relative">
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX))}
                  placeholder="Got an idea? Something broken? We'd love to hear it!"
                  rows={5}
                  className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
                <span
                  className={`absolute bottom-3 right-3 text-xs tabular-nums ${remaining < 100 ? "text-amber-500" : "text-muted-foreground/50"}`}
                >
                  {remaining}
                </span>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={submitting || !text.trim()}
                  className="rounded-xl gap-2"
                >
                  {submitting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
