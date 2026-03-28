import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { safeUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link as LinkIcon, Sparkles, DollarSign, Wand2, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  useCreateLink, 
  useUpdateLink, 
  useListTags,
  type LinkWithDetails 
} from "@workspace/api-client-react";
import { PRICE_RANGE_OPTIONS } from "@/lib/price-ranges";
import type { LinkPriceRange } from "@workspace/api-client-react";

const formSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL (e.g., https://example.com)")
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must start with http:// or https://"),
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title is too long"),
  summary: z.string().max(2000, "Summary is too long").optional().nullable(),
  comment: z.string().max(500, "Comment is too long").optional().nullable(),
  tagIds: z.array(z.number()).max(5, "Maximum 5 tags allowed"),
  priceRange: z.string().optional().nullable(),
  format: z.enum(["online", "in_person", "physical", "blended"]).optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface LinkFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link?: LinkWithDetails;
}

export function LinkFormDialog({ open, onOpenChange, link }: LinkFormDialogProps) {
  const isEditing = !!link;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tags = [] } = useListTags();
  
  const createMutation = useCreateLink();
  const updateMutation = useUpdateLink();

  const [aiEnabled, setAiEnabled] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  type DuplicateInfo = { existingTitle: string; existingUrl: string; existingStatus: string } | null;
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo>(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: link?.url || "",
      title: link?.title || "",
      summary: link?.summary || "",
      comment: link?.comment || "",
      tagIds: link?.tags?.map(t => t.id) || [],
      priceRange: link?.priceRange || null,
      format: (link as any)?.format || null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        url: link?.url || "",
        title: link?.title || "",
        summary: link?.summary || "",
        comment: link?.comment || "",
        tagIds: link?.tags?.map(t => t.id) || [],
        priceRange: link?.priceRange || null,
        format: (link as any)?.format || null,
      });
      setAiEnabled(false);
      setDuplicateInfo(null);
      setDuplicateAcknowledged(false);
    }
  }, [link, open, form]);

  const checkUrlDuplicate = async (url: string) => {
    if (!url || isEditing) return;
    try { new URL(url); } catch { return; }
    setIsCheckingDuplicate(true);
    setDuplicateInfo(null);
    setDuplicateAcknowledged(false);
    try {
      const res = await fetch(`/api/links/check-url?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.duplicate) {
        setDuplicateInfo({ existingTitle: data.existingTitle, existingUrl: data.existingUrl, existingStatus: data.existingStatus });
      }
    } catch {
      // silently ignore — check is best-effort
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const toggleTag = (tagId: number) => {
    const currentTags = form.getValues("tagIds");
    if (currentTags.includes(tagId)) {
      form.setValue("tagIds", currentTags.filter(id => id !== tagId), { shouldValidate: true });
    } else {
      if (currentTags.length >= 5) {
        toast({ title: "Too many tags", description: "You can select up to 5 tags.", variant: "destructive" });
        return;
      }
      form.setValue("tagIds", [...currentTags, tagId], { shouldValidate: true });
    }
  };

  const runAiAnalysis = async () => {
    const url = form.getValues("url");
    if (!url) {
      toast({ title: "Enter a URL first", description: "Add the website URL before generating suggestions.", variant: "destructive" });
      return;
    }

    // Validate URL format before sending
    try { new URL(url); } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid URL before generating suggestions.", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();

      if (data.title) form.setValue("title", data.title, { shouldValidate: true });
      if (data.summary) form.setValue("summary", data.summary, { shouldValidate: true });
      if (data.priceRange) form.setValue("priceRange", data.priceRange);
      if (Array.isArray(data.tagIds) && data.tagIds.length > 0) {
        form.setValue("tagIds", data.tagIds.slice(0, 5), { shouldValidate: true });
      }

      toast({ title: "✨ Fields filled!", description: "Review the suggestions and make any edits before submitting." });
    } catch (err) {
      toast({ title: "AI analysis failed", description: "Could not analyze the URL. Please fill in the fields manually.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        priceRange: (values.priceRange || null) as LinkPriceRange | null,
      };

      if (isEditing) {
        await updateMutation.mutateAsync({ id: link.id, data: payload });
        toast({ title: "Resource updated", description: "Your changes have been saved." });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: "Resource added", description: "Thanks for sharing with the community!" });
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || "Something went wrong.", 
        variant: "destructive" 
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isBlockedByDuplicate = !isEditing && !!duplicateInfo && !duplicateAcknowledged;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card rounded-[24px] shadow-2xl p-0 overflow-hidden border-border/50">
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 px-6 py-8 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-3xl font-display text-foreground flex items-center gap-2">
              {isEditing ? "Edit Resource" : "Share a Resource"}
              {!isEditing && <Sparkles className="w-6 h-6 text-accent" />}
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground mt-2">
              {isEditing 
                ? "Update the details for this educational link." 
                : "Discovered a trail-worthy educational site? Drop it into the Stash for your fellow adventurers."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-4">

            {/* URL + AI toggle */}
            <div className="space-y-2">
              <Label htmlFor="url" className="text-sm font-bold text-foreground">Website URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                {isCheckingDuplicate && (
                  <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Input
                  id="url"
                  placeholder="https://example.com"
                  className="pl-10 h-12 rounded-xl bg-background border-2 border-border/50 focus-visible:border-primary focus-visible:ring-primary/20"
                  {...form.register("url")}
                  onBlur={(e) => {
                    form.register("url").onBlur(e);
                    checkUrlDuplicate(e.target.value);
                  }}
                />
              </div>
              {form.formState.errors.url && (
                <p className="text-sm text-destructive font-medium">{form.formState.errors.url.message}</p>
              )}

              {/* Duplicate warning banner */}
              {duplicateInfo && !duplicateAcknowledged && (
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-orange-50 border border-orange-300">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-bold text-orange-900">This site may already be in the hub</p>
                      <p className="text-orange-800 mt-0.5">
                        We found an existing resource:{" "}
                        <a
                          href={safeUrl(duplicateInfo.existingUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-semibold hover:text-orange-900"
                        >
                          {duplicateInfo.existingTitle}
                        </a>
                        {duplicateInfo.existingStatus === "pending" && " (awaiting review)"}
                        {duplicateInfo.existingStatus === "rejected" && " (rejected)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      className="rounded-xl border-orange-300 text-orange-900 hover:bg-orange-100"
                    >
                      Never mind
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setDuplicateAcknowledged(true)}
                      className="rounded-xl bg-orange-600 text-white hover:bg-orange-700"
                    >
                      Add anyway
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* AI auto-fill option */}
            {!isEditing && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <Checkbox
                  id="ai-fill"
                  checked={aiEnabled}
                  onCheckedChange={(v) => setAiEnabled(!!v)}
                  className="mt-0.5 border-amber-400 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <div className="flex-grow min-w-0">
                  <label htmlFor="ai-fill" className="text-sm font-bold text-amber-900 cursor-pointer flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-primary" />
                    Auto-fill fields with AI
                  </label>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Enter a URL above, then let AI suggest a title, summary, price, and subject tags. You can edit them afterwards.
                  </p>
                  {aiEnabled && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={runAiAnalysis}
                      disabled={isAnalyzing}
                      className="mt-3 rounded-xl font-bold bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                    >
                      {isAnalyzing
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</>
                        : <><Wand2 className="w-4 h-4 mr-2" />Generate Suggestions</>
                      }
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-bold text-foreground">Resource Title</Label>
              <Input 
                id="title" 
                placeholder="A short, descriptive name for the resource"
                className="h-12 rounded-xl bg-background border-2 border-border/50 focus-visible:border-primary focus-visible:ring-primary/20"
                {...form.register("title")} 
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive font-medium">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary" className="text-sm font-bold text-foreground">Short Summary (Optional)</Label>
              <Input 
                id="summary" 
                placeholder="What does this site offer? Who is it best for?"
                className="h-12 rounded-xl bg-background border-2 border-border/50 focus-visible:border-primary focus-visible:ring-primary/20"
                {...form.register("summary")} 
              />
            </div>

            {/* Pricing */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                Pricing (Optional)
              </Label>
              <Select
                value={form.watch("priceRange") || "none"}
                onValueChange={(v) => form.setValue("priceRange", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-12 rounded-xl bg-background border-2 border-border/50 focus:border-primary focus:ring-primary/20 font-medium">
                  <SelectValue placeholder="Select price range…" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/50 shadow-xl">
                  <SelectItem value="none" className="rounded-lg font-medium cursor-pointer text-muted-foreground">
                    Not specified
                  </SelectItem>
                  {PRICE_RANGE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="rounded-lg font-medium cursor-pointer">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <Label className="text-sm font-bold text-foreground">Format (Optional)</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: "online",    label: "Online",    icon: "🌐" },
                  { value: "in_person", label: "In Person", icon: "📍" },
                  { value: "physical",  label: "Physical",  icon: "📦" },
                  { value: "blended",   label: "Blended",   icon: "🔀" },
                ] as const).map(opt => {
                  const selected = form.watch("format") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => form.setValue("format", selected ? null : opt.value)}
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl border-2 text-sm font-semibold transition-all
                        ${selected
                          ? "bg-primary text-primary-foreground border-primary shadow-md"
                          : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:bg-primary/5"
                        }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment" className="text-sm font-bold text-foreground">Your Thoughts (Optional)</Label>
              <Textarea 
                id="comment" 
                placeholder="How do you use this in your curriculum? Any tips?" 
                className="resize-none min-h-[100px] rounded-xl bg-background border-2 border-border/50 focus-visible:border-primary focus-visible:ring-primary/20"
                {...form.register("comment")} 
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">Tags (Select up to 5)</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = form.watch("tagIds").includes(tag.id);
                  return (
                    <Badge 
                      key={tag.id}
                      variant={isSelected ? "default" : "outline"}
                      className={`
                        cursor-pointer text-sm py-1.5 px-3 rounded-lg transition-all duration-200
                        ${isSelected 
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 scale-105" 
                          : "hover:border-primary/50 hover:bg-primary/5 bg-background text-muted-foreground border-2"}
                      `}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
              {form.formState.errors.tagIds && (
                <p className="text-sm text-destructive font-medium">{form.formState.errors.tagIds.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending || isBlockedByDuplicate}
              className="rounded-xl h-11 px-8 font-semibold bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isEditing ? "Save Changes" : "Share Resource"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
