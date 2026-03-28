import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { safeUrl } from "@/lib/utils";
import {
  useAddReaction,
  useDeleteLink,
  type LinkWithDetails
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  MoreVertical,
  Pencil,
  Trash2,
  MessageSquare,
  Globe,
  Clock,
  XCircle,
  Smile,
  Send,
  Loader2,
  Image,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getPriceRangeOption } from "@/lib/price-ranges";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { LinkFormDialog } from "./link-form-dialog";
import { useToast } from "@/hooks/use-toast";

const MAX_COMMENT_LENGTH = 1000;

interface CommentUser {
  id?: string;
  name: string;
  avatarUrl?: string | null;
}

interface Comment {
  id: number;
  linkId: number;
  userId: string;
  body: string;
  createdAt: string;
  user: CommentUser;
}

const COMMON_EMOJIS = ["👍", "❤️", "⭐", "🎉", "💡", "🧠"];

interface LinkCardProps {
  link: LinkWithDetails;
  index: number;
}

export function LinkCard({ link, index }: LinkCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Thumbnail editor state
  const [thumbnailEditing, setThumbnailEditing] = useState(false);
  const [thumbnailInput, setThumbnailInput] = useState("");
  const [thumbnailFetching, setThumbnailFetching] = useState(false);
  const [thumbnailSaving, setThumbnailSaving] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const addReactionMutation = useAddReaction();
  const deleteMutation = useDeleteLink();

  const isOwner = user && user.id === link.userId;
  const isApproved = link.status === "approved";
  const isAdmin = (user as any)?.isAdmin === true;

  const handleReaction = async (emoji: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Sign in to react to resources!"
      });
      return;
    }
    try {
      await addReactionMutation.mutateAsync({ id: link.id, data: { emoji } });
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      setShowEmojiPicker(false);
    } catch {
      toast({ title: "Error", description: "Failed to add reaction.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remove this resource from the Stash?")) return;
    try {
      await deleteMutation.mutateAsync({ id: link.id });
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      toast({ title: "Removed", description: "Resource has been deleted." });
    } catch {
      toast({ title: "Error", description: "Failed to delete resource.", variant: "destructive" });
    }
  };

  // Load comments whenever the detail modal opens
  useEffect(() => {
    if (!isDetailOpen) return;
    setCommentsLoading(true);
    fetch(`/api/links/${link.id}/comments`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((data: Comment[]) => setComments(data))
      .catch(() => toast({ title: "Error", description: "Failed to load comments.", variant: "destructive" }))
      .finally(() => setCommentsLoading(false));
  }, [isDetailOpen, link.id]);

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = commentBody.trim();
    if (!body) return;
    if (body.length > MAX_COMMENT_LENGTH) {
      toast({ title: "Too long", description: `Comments must be ${MAX_COMMENT_LENGTH} characters or fewer.`, variant: "destructive" });
      return;
    }
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/links/${link.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to post comment");
      }
      const newComment: Comment = await res.json();
      setComments(prev => [...prev, newComment]);
      setCommentBody("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to post comment.", variant: "destructive" });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    setDeletingCommentId(commentId);
    try {
      const res = await fetch(`/api/links/${link.id}/comments/${commentId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete comment");
      }
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete comment.", variant: "destructive" });
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleFetchOg = async () => {
    setThumbnailFetching(true);
    try {
      const res = await fetch(`/api/links/fetch-og?url=${encodeURIComponent(link.url)}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.imageUrl) {
        setThumbnailInput(data.imageUrl);
      } else {
        toast({ title: "No image found", description: "This site doesn't have an OG image we could detect.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not fetch OG image.", variant: "destructive" });
    } finally {
      setThumbnailFetching(false);
    }
  };

  const handleSaveThumbnail = async () => {
    setThumbnailSaving(true);
    try {
      const res = await fetch(`/api/links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: thumbnailInput.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/links"] });
      toast({ title: "Thumbnail updated" });
      setThumbnailEditing(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setThumbnailSaving(false);
    }
  };

  let domain = "";
  try {
    domain = new URL(link.url).hostname.replace("www.", "");
  } catch {
    domain = link.url;
  }

  const FORMAT_META: Record<string, { label: string; icon: string }> = {
    online:    { label: "Online",    icon: "🌐" },
    in_person: { label: "In Person", icon: "📍" },
    physical:  { label: "Physical",  icon: "📦" },
    blended:   { label: "Blended",   icon: "🔀" },
  };
  const formatMeta = (link as any).format ? FORMAT_META[(link as any).format] : null;

  const authorDisplay = (link.user.displayName || link.user.firstName || link.user.email || "Anonymous").split(" ")[0];
  const authorInitial = ((link.user.displayName || link.user.firstName || link.user.email || "?")[0]).toUpperCase();
  const priceOpt = link.priceRange ? getPriceRangeOption(link.priceRange) : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: index * 0.05, ease: "easeOut" }}
        className="flex flex-col"
      >
        {/* Pending/Rejected banner — only visible to the submitter */}
        {link.status === "pending" && isOwner && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-x border-t border-amber-200 rounded-t-2xl text-xs font-bold text-amber-700">
            <Clock className="w-3.5 h-3.5" />
            Awaiting submission review
          </div>
        )}
        {link.status === "rejected" && isOwner && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-x border-t border-red-200 rounded-t-2xl text-xs font-bold text-red-600">
            <XCircle className="w-3.5 h-3.5" />
            Rejected — this resource was not approved
          </div>
        )}

        <div
          onClick={() => isApproved && setIsDetailOpen(true)}
          className={`group flex flex-col bg-card overflow-hidden border shadow-sm transition-all duration-300 flex-grow ${
            link.status === "pending" && isOwner
              ? "opacity-60 border-amber-200 rounded-b-2xl pointer-events-none grayscale"
              : link.status === "rejected" && isOwner
              ? "opacity-50 border-red-200 rounded-b-2xl pointer-events-none grayscale"
              : "border-primary/10 rounded-2xl hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer"
          }`}
        >
          {/* Thumbnail */}
          <div className="relative h-48 w-full bg-muted overflow-hidden">
            {link.thumbnailUrl ? (
              <img
                src={link.thumbnailUrl}
                alt={link.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-amber-200/20 to-amber-100/30 flex flex-col items-center justify-center text-foreground/40">
                <Globe className="w-12 h-12 mb-2 opacity-50" />
                <span className="font-medium text-sm opacity-60 px-4 text-center line-clamp-1">{domain}</span>
              </div>
            )}

            {/* Owner/admin actions overlay */}
            <div className="absolute top-3 right-3 flex gap-2" onClick={e => e.stopPropagation()}>
              {(isOwner || isAdmin) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="secondary" className="w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm border-0 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4 text-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl p-1">
                    {isOwner && (
                      <DropdownMenuItem onClick={() => setIsEditModalOpen(true)} className="rounded-lg cursor-pointer">
                        <Pencil className="w-4 h-4 mr-2" /> Edit Resource
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { setThumbnailInput(link.thumbnailUrl || ""); setThumbnailEditing(true); setIsDetailOpen(true); }} className="rounded-lg cursor-pointer">
                      <Image className="w-4 h-4 mr-2" /> Edit Thumbnail
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleDelete}
                      className="rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Tag badges on image */}
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
              {link.tags.slice(0, 3).map(tag => (
                <Badge
                  key={tag.id}
                  className="bg-background/90 backdrop-blur-md text-foreground border-0 shadow-sm font-semibold py-0.5 px-2 text-xs"
                >
                  {tag.name}
                </Badge>
              ))}
              {link.tags.length > 3 && (
                <Badge className="bg-background/90 backdrop-blur-md text-foreground border-0 shadow-sm font-semibold py-0.5 px-2 text-xs">
                  +{link.tags.length - 3}
                </Badge>
              )}
            </div>

            {/* Price + format badges */}
            <div className="absolute top-3 left-3 flex gap-1.5">
              {priceOpt && (
                <div className={`text-xs font-bold px-2 py-1 rounded-full border shadow-sm ${priceOpt.color}`}>
                  {priceOpt.badge}
                </div>
              )}
              {formatMeta && (
                <div className="text-xs font-bold px-2 py-1 rounded-full bg-background/90 backdrop-blur-md border border-border shadow-sm text-foreground">
                  {formatMeta.icon} {formatMeta.label}
                </div>
              )}
            </div>
          </div>

          {/* Card body */}
          <div className="flex flex-col flex-grow p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-bold text-lg text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {link.title}
              </h3>
              <a
                href={safeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="shrink-0 p-2 -mr-2 -mt-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <a
              href={safeUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs font-semibold text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-1 mb-3 w-fit"
            >
              {domain}
            </a>

            <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 mb-4 flex-grow">
              {link.summary || "No summary provided."}
            </p>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-primary/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="w-7 h-7 border border-primary/20 shadow-sm">
                  <AvatarImage src={link.user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {authorInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground leading-none">{authorDisplay}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 relative" onClick={e => e.stopPropagation()}>
                {link.reactions.slice(0, 3).map(reaction => (
                  <button
                    key={reaction.emoji}
                    onClick={e => handleReaction(reaction.emoji, e)}
                    disabled={addReactionMutation.isPending}
                    className={`
                      flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-full transition-all
                      ${reaction.userReacted
                        ? "bg-primary/15 text-primary border border-primary/25 shadow-sm scale-105"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 border border-transparent hover:border-primary/15"}
                    `}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                  </button>
                ))}

                <div className="relative">
                  <button
                    onClick={e => { e.stopPropagation(); setShowEmojiPicker(v => !v); }}
                    title="Add reaction"
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors ml-0.5"
                  >
                    <Smile className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 8 }}
                        className="absolute bottom-full right-0 mb-2 p-2 bg-popover border border-primary/15 shadow-xl rounded-2xl flex gap-1 z-10"
                      >
                        {COMMON_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={e => handleReaction(emoji, e)}
                            className="w-8 h-8 flex items-center justify-center text-base hover:bg-primary/10 rounded-full transition-colors hover:scale-110"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detail modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-3xl">
          <DialogTitle className="sr-only">{link.title}</DialogTitle>

          {/* Modal thumbnail */}
          <div className="relative h-56 w-full bg-muted shrink-0">
            {link.thumbnailUrl ? (
              <img src={link.thumbnailUrl} alt={link.title} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-amber-200/20 to-amber-100/30 flex flex-col items-center justify-center text-foreground/40">
                <Globe className="w-16 h-16 mb-2 opacity-40" />
                <span className="font-medium text-sm opacity-60">{domain}</span>
              </div>
            )}
            {priceOpt && (
              <div className={`absolute top-4 left-4 text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm ${priceOpt.color}`}>
                {priceOpt.badge}
              </div>
            )}
          </div>

          {/* Thumbnail editor (owner or admin) */}
          {(isOwner || isAdmin) && thumbnailEditing && (
            <div className="px-5 pt-4 pb-0 space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5" /> Thumbnail Image
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={thumbnailInput}
                  onChange={e => setThumbnailInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 text-sm border border-input rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFetchOg}
                  disabled={thumbnailFetching}
                  className="rounded-xl text-xs font-bold shrink-0"
                  title="Auto-fetch social preview image"
                >
                  {thumbnailFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fetch OG"}
                </Button>
              </div>
              {thumbnailInput && (
                <img src={thumbnailInput} alt="Preview" className="w-full h-28 object-cover rounded-xl border" onError={e => (e.currentTarget.style.display = "none")} />
              )}
              <div className="flex gap-2 justify-end pt-1">
                <Button size="sm" variant="ghost" onClick={() => setThumbnailEditing(false)} className="rounded-xl text-xs h-8">
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveThumbnail} disabled={thumbnailSaving} className="rounded-xl text-xs h-8">
                  {thumbnailSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Modal body */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
            {/* Title + link */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-foreground leading-snug">{link.title}</h2>
              <a
                href={safeUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Visit site
              </a>
            </div>

            <a
              href={safeUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary/70 hover:text-primary hover:underline inline-flex items-center gap-1 -mt-3"
            >
              {domain}
            </a>

            {/* Tags */}
            {link.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {link.tags.map(tag => (
                  <Badge key={tag.id} className="bg-primary/10 text-primary border-primary/20 font-semibold px-3 py-1 rounded-xl text-xs">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Format badge in modal */}
            {formatMeta && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Format</span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {formatMeta.icon} {formatMeta.label}
                </span>
              </div>
            )}

            {/* Summary */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Summary</p>
              <p className="text-sm text-foreground leading-relaxed">
                {link.summary || "No summary provided."}
              </p>
            </div>

            {/* Parent's notes */}
            {link.comment && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Parent's Notes
                </p>
                <div className="p-4 bg-primary/5 rounded-xl text-sm italic text-foreground border border-primary/15 relative pl-5">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                  "{link.comment}"
                </div>
              </div>
            )}

            {/* Reactions */}
            {link.reactions.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Reactions</p>
                <div className="flex flex-wrap gap-2">
                  {link.reactions.map(reaction => (
                    <button
                      key={reaction.emoji}
                      onClick={() => handleReaction(reaction.emoji)}
                      disabled={addReactionMutation.isPending}
                      className={`flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-full transition-all border ${
                        reaction.userReacted
                          ? "bg-primary/15 text-primary border-primary/25 shadow-sm"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-primary/10 hover:border-primary/15"
                      }`}
                    >
                      <span>{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="pt-4 border-t border-primary/10">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Comments
                {comments.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">
                    {comments.length}
                  </span>
                )}
              </p>

              {/* Comment list */}
              {commentsLoading ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm">Loading comments…</span>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic mb-4">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map(comment => {
                    const initial = (comment.user.name?.[0] ?? "?").toUpperCase();
                    const canDelete = user && (user.id === comment.userId || isAdmin);
                    return (
                      <div key={comment.id} className="flex gap-2.5 group/comment">
                        <Avatar className="w-7 h-7 shrink-0 border border-primary/20 mt-0.5">
                          <AvatarImage src={comment.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                            {initial}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground">{comment.user.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                            </span>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deletingCommentId === comment.id}
                                className="ml-auto text-[10px] text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/comment:opacity-100 shrink-0"
                                title="Delete comment"
                              >
                                {deletingCommentId === comment.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-foreground leading-relaxed mt-0.5 break-words">
                            {comment.body}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* New comment form */}
              {user ? (
                <form onSubmit={handleCommentSubmit} className="flex flex-col gap-2">
                  <div className="relative">
                    <Textarea
                      ref={commentInputRef}
                      value={commentBody}
                      onChange={e => setCommentBody(e.target.value)}
                      placeholder="Leave a comment…"
                      rows={2}
                      maxLength={MAX_COMMENT_LENGTH}
                      className="resize-none rounded-xl pr-12 text-sm"
                      disabled={commentSubmitting}
                    />
                    <button
                      type="submit"
                      disabled={!commentBody.trim() || commentSubmitting}
                      className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                      title="Post comment"
                    >
                      {commentSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {commentBody.length > MAX_COMMENT_LENGTH * 0.8 && (
                    <p className={`text-xs text-right ${commentBody.length >= MAX_COMMENT_LENGTH ? "text-destructive" : "text-muted-foreground"}`}>
                      {commentBody.length}/{MAX_COMMENT_LENGTH}
                    </p>
                  )}
                </form>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sign in to leave a comment.</p>
              )}
            </div>

            {/* Submitted by */}
            <div className="pt-4 border-t border-primary/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar className="w-8 h-8 border border-primary/20 shadow-sm">
                  <AvatarImage src={link.user.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {authorInitial}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{authorDisplay}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Submitted {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {(isOwner || isAdmin) && (
                <div className="flex gap-2">
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 px-3 font-bold text-xs"
                      onClick={() => { setIsDetailOpen(false); setIsEditModalOpen(true); }}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl h-8 px-3 font-bold text-xs"
                    onClick={() => { setThumbnailInput(link.thumbnailUrl || ""); setThumbnailEditing(true); }}
                  >
                    <Image className="w-3.5 h-3.5 mr-1" /> Thumbnail
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isEditModalOpen && (
        <LinkFormDialog
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          link={link}
        />
      )}
    </>
  );
}
