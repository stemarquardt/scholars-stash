import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Globe,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Clock,
  Users,
  ListChecks,
  Shield,
  UserCheck,
  UserX,
  Tag,
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Save,
  X,
  Lightbulb,
  CircleCheck,
} from "lucide-react";
import { safeUrl } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Types ────────────────────────────────────────────────────────────────────

type AdminLink = {
  id: number;
  url: string;
  title: string;
  summary?: string | null;
  comment?: string | null;
  thumbnailUrl?: string | null;
  status: string;
  createdAt: string;
  userId: string;
  tags: Array<{ id: number; name: string; slug: string; color: string }>;
  user: { id?: string; name?: string; email?: string; avatarUrl?: string | null };
};

type AdminUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  profileImageUrl?: string | null;
  isAdmin: boolean;
  isApproved: boolean;
  createdAt: string;
};

type AdminTag = {
  id: number;
  name: string;
  slug: string;
  color: string;
};

// ── API helpers ──────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "pending", label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { key: "approved", label: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700 border-red-200" },
];

const TAG_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4",
  "#ec4899", "#f97316", "#14b8a6", "#8b5cf6", "#64748b",
  "#84cc16", "#ef4444", "#6366f1", "#0ea5e9", "#d946ef",
];

type Suggestion = {
  id: number;
  body: string;
  status: "pending" | "done";
  createdAt: string;
  user: { id: string; displayName?: string | null; profileImageUrl?: string | null; email?: string | null } | null;
};

type PageSection = "members" | "links" | "tags" | "suggestions";

// ── Main component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("pending");
  const [section, setSection] = useState<PageSection>("members");

  // Links
  const { data: links = [], isLoading: linksLoading, refetch: refetchLinks } = useQuery<AdminLink[]>({
    queryKey: ["admin-links", activeTab],
    queryFn: () => apiFetch(`/api/admin/links?status=${activeTab}`),
    enabled: !!user?.isAdmin && section === "links",
  });

  // Users
  const { data: adminUsers = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/admin/users"),
    enabled: !!user?.isAdmin,
    refetchInterval: 30_000,
  });

  // Tags
  const { data: allTags = [], isLoading: tagsLoading, refetch: refetchTags } = useQuery<AdminTag[]>({
    queryKey: ["admin-tags"],
    queryFn: () => apiFetch("/api/tags"),
    enabled: !!user?.isAdmin,
  });

  // Suggestions
  const { data: suggestions = [], isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<Suggestion[]>({
    queryKey: ["admin-suggestions"],
    queryFn: () => apiFetch("/api/suggestions"),
    enabled: !!user?.isAdmin && section === "suggestions",
  });

  const markDoneMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/suggestions/${id}/done`, { method: "PATCH" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] }); toast({ title: "Marked as done" }); },
    onError: () => toast({ title: "Error", description: "Failed to update.", variant: "destructive" }),
  });

  const deleteSuggestionMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/suggestions/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] }); toast({ title: "Deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
  });

  // ── Mutations ──

  const approveLinkMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/links/${id}/approve`, { method: "PUT" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-links"] }); toast({ title: "✅ Approved", description: "Resource is now live." }); },
    onError: () => toast({ title: "Error", description: "Failed to approve.", variant: "destructive" }),
  });

  const rejectLinkMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/links/${id}/reject`, { method: "PUT" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-links"] }); toast({ title: "❌ Rejected" }); },
    onError: () => toast({ title: "Error", description: "Failed to reject.", variant: "destructive" }),
  });

  const approveUserMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}/approve`, { method: "PUT" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "✅ Member approved" }); },
    onError: () => toast({ title: "Error", description: "Failed to approve member.", variant: "destructive" }),
  });

  const revokeUserMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}/revoke`, { method: "PUT" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Access revoked" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/admin/users/${id}/toggle-admin`, { method: "PUT" }),
    onSuccess: (data: AdminUser) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: data.isAdmin ? "🛡️ Promoted to admin" : "Admin removed" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update admin status.", variant: "destructive" }),
  });

  const createTagMutation = useMutation({
    mutationFn: (body: { name: string; color: string }) =>
      apiFetch("/api/admin/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-tags"] }); toast({ title: "Tag created" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; name: string; color: string }) =>
      apiFetch(`/api/admin/tags/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-tags"] }); toast({ title: "Tag updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-tags"] }); toast({ title: "Tag deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete tag.", variant: "destructive" }),
  });

  // ── Guards ──

  if (isLoading) {
    return (
      <div className="min-h-screen honeycomb-bg flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen honeycomb-bg flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center gap-4 text-center px-4">
          <ShieldAlert className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Sign in required</h2>
        </main>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen honeycomb-bg flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center gap-4 text-center px-4">
          <ShieldAlert className="w-16 h-16 text-destructive/60" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Admin privileges required.</p>
        </main>
      </div>
    );
  }

  const pendingCount = adminUsers.filter(u => !u.isApproved && !u.isAdmin).length;
  const isBusy = approveLinkMutation.isPending || rejectLinkMutation.isPending;

  const handleRefresh = () => {
    if (section === "links") refetchLinks();
    else if (section === "members") refetchUsers();
    else if (section === "suggestions") refetchSuggestions();
    else refetchTags();
  };

  return (
    <div className="min-h-screen honeycomb-bg flex flex-col">
      <Header />

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 sm:px-6 py-10">
        <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground mt-1">Manage members, tags, and moderate resources.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="rounded-xl border-2 font-semibold gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-3 mb-8 flex-wrap">
          <SectionTab active={section === "members"} onClick={() => setSection("members")} icon={<Users className="w-4 h-4" />} label="Members" badge={pendingCount > 0 ? pendingCount : undefined} />
          <SectionTab active={section === "links"} onClick={() => setSection("links")} icon={<ListChecks className="w-4 h-4" />} label="Moderation Queue" />
          <SectionTab active={section === "tags"} onClick={() => setSection("tags")} icon={<Tag className="w-4 h-4" />} label="Tags" />
          <SectionTab active={section === "suggestions"} onClick={() => setSection("suggestions")} icon={<Lightbulb className="w-4 h-4" />} label="Suggestions" badge={suggestions.filter(s => s.status === "pending").length || undefined} />
        </div>

        {/* ── MEMBERS ── */}
        {section === "members" && (
          <MembersSection
            users={adminUsers}
            loading={usersLoading}
            currentUserId={user.id}
            onApprove={id => approveUserMutation.mutate(id)}
            onRevoke={id => revokeUserMutation.mutate(id)}
            onToggleAdmin={id => toggleAdminMutation.mutate(id)}
            approvePending={approveUserMutation.isPending}
            revokePending={revokeUserMutation.isPending}
            toggleAdminPending={toggleAdminMutation.isPending}
          />
        )}

        {/* ── MODERATION QUEUE ── */}
        {section === "links" && (
          <ModerationSection
            links={links}
            loading={linksLoading}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isBusy={isBusy}
            onApprove={id => approveLinkMutation.mutate(id)}
            onReject={id => rejectLinkMutation.mutate(id)}
          />
        )}

        {/* ── TAGS ── */}
        {section === "tags" && (
          <TagsSection
            tags={allTags}
            loading={tagsLoading}
            onCreate={body => createTagMutation.mutateAsync(body)}
            onUpdate={body => updateTagMutation.mutateAsync(body)}
            onDelete={id => deleteTagMutation.mutateAsync(id)}
          />
        )}

        {/* ── SUGGESTIONS ── */}
        {section === "suggestions" && (
          <SuggestionsSection
            suggestions={suggestions}
            loading={suggestionsLoading}
            onMarkDone={id => markDoneMutation.mutate(id)}
            onDelete={id => deleteSuggestionMutation.mutate(id)}
          />
        )}
      </main>
    </div>
  );
}

// ── Section tab button ────────────────────────────────────────────────────────

function SectionTab({ active, onClick, icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
          : "bg-background text-muted-foreground border-border hover:border-primary/30"
      }`}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Members section ───────────────────────────────────────────────────────────

function MembersSection({ users, loading, currentUserId, onApprove, onRevoke, onToggleAdmin, approvePending, revokePending, toggleAdminPending }: {
  users: AdminUser[];
  loading: boolean;
  currentUserId: string;
  onApprove: (id: string) => void;
  onRevoke: (id: string) => void;
  onToggleAdmin: (id: string) => void;
  approvePending: boolean;
  revokePending: boolean;
  toggleAdminPending: boolean;
}) {
  const sorted = [
    ...users.filter(u => !u.isApproved && !u.isAdmin),
    ...users.filter(u => u.isApproved && !u.isAdmin),
    ...users.filter(u => u.isAdmin),
  ];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Members</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage member access and admin privileges.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : users.length === 0 ? (
        <EmptyState emoji="🦉" title="No members yet" subtitle="Nobody has signed up yet." />
      ) : (
        <div className="space-y-3">
          {sorted.map(u => {
            const name = u.displayName || u.firstName || u.email || "Unknown";
            const initial = name[0]?.toUpperCase() || "?";
            const isPending = !u.isApproved && !u.isAdmin;
            const isSelf = u.id === currentUserId;

            return (
              <div
                key={u.id}
                className={`bg-card rounded-2xl border shadow-sm p-4 flex items-center gap-4 flex-wrap ${
                  isPending ? "border-amber-200 bg-amber-50/40" : "border-primary/10"
                }`}
              >
                <Avatar className="w-10 h-10 border border-primary/20 shrink-0">
                  <AvatarImage src={u.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initial}</AvatarFallback>
                </Avatar>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-sm">{name}</span>
                    {isSelf && (
                      <span className="text-xs text-muted-foreground font-medium">(you)</span>
                    )}
                    {u.isAdmin && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> Pending Approval
                      </span>
                    )}
                    {!isPending && !u.isAdmin && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                      </span>
                    )}
                  </div>
                  {u.email && <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    Joined {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </p>
                </div>

                {!isSelf && (
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {isPending && (
                      <Button size="sm" disabled={approvePending} onClick={() => onApprove(u.id)}
                        className="rounded-xl font-bold gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-md">
                        {approvePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                        Approve
                      </Button>
                    )}
                    {!isPending && !u.isAdmin && (
                      <Button size="sm" variant="outline" disabled={revokePending} onClick={() => onRevoke(u.id)}
                        className="rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold gap-1.5">
                        {revokePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                        Revoke
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={toggleAdminPending} onClick={() => onToggleAdmin(u.id)}
                      className={`rounded-xl border-2 font-bold gap-1.5 ${
                        u.isAdmin
                          ? "border-violet-200 text-violet-700 hover:bg-violet-50"
                          : "border-border text-muted-foreground hover:border-violet-300 hover:text-violet-700"
                      }`}>
                      {toggleAdminPending ? <Loader2 className="w-4 h-4 animate-spin" /> : u.isAdmin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                      {u.isAdmin ? "Remove Admin" : "Make Admin"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Tags section ──────────────────────────────────────────────────────────────

function TagsSection({ tags, loading, onCreate, onUpdate, onDelete }: {
  tags: AdminTag[];
  loading: boolean;
  onCreate: (body: { name: string; color: string }) => Promise<any>;
  onUpdate: (body: { id: number; name: string; color: string }) => Promise<any>;
  onDelete: (id: number) => Promise<any>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const startEdit = (tag: AdminTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editName.trim() || editingId === null) return;
    setSaving(true);
    try {
      await onUpdate({ id: editingId, name: editName.trim(), color: editColor });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await onCreate({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor("#6366f1");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this tag? It will be removed from all submissions.")) return;
    setDeleting(id);
    try { await onDelete(id); } finally { setDeleting(null); }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Tags</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage the subject tags available for resource submissions.</p>
      </div>

      {/* Add new tag */}
      <div className="bg-card rounded-2xl border border-primary/15 p-5 mb-6">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Add New Tag
        </h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-grow min-w-[180px]">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Name</label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Creative Writing"
              className="rounded-xl h-10"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Color</label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <Button onClick={handleCreate} disabled={!newName.trim() || saving}
            className="rounded-xl h-10 font-bold gap-2 shadow-md">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Tag
          </Button>
        </div>
      </div>

      {/* Tag list */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : tags.length === 0 ? (
        <EmptyState emoji="🏷️" title="No tags yet" subtitle="Add your first tag above." />
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <div key={tag.id} className="bg-card rounded-2xl border border-primary/10 shadow-sm p-4 flex items-center gap-4 flex-wrap">
              {editingId === tag.id ? (
                <>
                  <div className="flex gap-3 flex-grow flex-wrap items-end">
                    <div className="flex-grow min-w-[160px]">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                        className="rounded-xl h-9"
                        autoFocus
                      />
                    </div>
                    <ColorPicker value={editColor} onChange={setEditColor} />
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={saveEdit} disabled={!editName.trim() || saving}
                      className="rounded-xl font-bold gap-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit} className="rounded-xl font-bold gap-1.5">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: tag.color }} />
                  <span className="font-semibold text-foreground flex-grow">{tag.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{tag.slug}</span>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => startEdit(tag)}
                      className="rounded-xl border-2 font-bold gap-1.5 h-8 px-3">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(tag.id)} disabled={deleting === tag.id}
                      className="rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold gap-1.5 h-8 px-3">
                      {deleting === tag.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Moderation section ────────────────────────────────────────────────────────

function ModerationSection({ links, loading, activeTab, onTabChange, isBusy, onApprove, onReject }: {
  links: AdminLink[];
  loading: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isBusy: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Moderation Queue</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Review and approve submitted resources before they go live.</p>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button key={tab.key} onClick={() => onTabChange(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
              activeTab === tab.key ? tab.color + " shadow-sm scale-105" : "bg-background text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : links.length === 0 ? (
        <EmptyState emoji="🦉" title={activeTab === "pending" ? "No pending submissions" : `No ${activeTab} resources`}
          subtitle={activeTab === "pending" ? "The queue is clear — you're all caught up!" : "Nothing here yet."} />
      ) : (
        <div className="space-y-4">
          {links.map(link => {
            let domain = "";
            try { domain = new URL(link.url).hostname.replace("www.", ""); } catch { domain = link.url; }
            const submitterName = link.user.name || link.user.email || "Unknown";
            const submitterInitial = submitterName[0]?.toUpperCase() || "?";

            return (
              <div key={link.id} className="bg-card rounded-2xl border border-primary/10 shadow-sm overflow-hidden">
                <div className="flex gap-0">
                  {link.thumbnailUrl ? (
                    <div className="w-40 shrink-0 hidden sm:block">
                      <img src={link.thumbnailUrl} alt={link.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-40 shrink-0 hidden sm:flex items-center justify-center bg-muted">
                      <Globe className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-grow p-5">
                    <div className="flex items-start gap-4 mb-2">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-lg text-foreground leading-tight truncate">{link.title}</h3>
                          <StatusBadge status={link.status} />
                        </div>
                        <a href={safeUrl(link.url)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />{domain}
                        </a>
                      </div>
                    </div>
                    {link.summary && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{link.summary}</p>}
                    {link.comment && (
                      <p className="text-xs italic text-foreground/60 mb-3 border-l-2 border-primary/20 pl-3">"{link.comment}"</p>
                    )}
                    {link.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {link.tags.map(tag => (
                          <span key={tag.id} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary/80 border border-primary/15">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6 border border-primary/20">
                          <AvatarImage src={link.user.avatarUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{submitterInitial}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{submitterName}</span>
                          {" · "}{formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {(activeTab === "pending" || activeTab === "approved") && (
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => onReject(link.id)}
                            className="rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/10 font-bold gap-1.5">
                            <XCircle className="w-4 h-4" />{activeTab === "approved" ? "Revoke" : "Reject"}
                          </Button>
                        )}
                        {(activeTab === "pending" || activeTab === "rejected") && (
                          <Button size="sm" disabled={isBusy} onClick={() => onApprove(link.id)}
                            className="rounded-xl font-bold gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-md">
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Color picker ──────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
        {TAG_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${value === c ? "scale-125 border-foreground" : "border-transparent hover:scale-110"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg border-2 border-border cursor-pointer p-0.5" title="Custom color" />
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-muted/30 rounded-3xl border-2 border-dashed border-primary/15 text-center">
      <div className="text-5xl mb-4">{emoji}</div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
      <CheckCircle2 className="w-3 h-3" /> Approved
    </span>
  );
  if (status === "rejected") return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3" /> Rejected
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

// ── Suggestions section ───────────────────────────────────────────────────────

function SuggestionsSection({ suggestions, loading, onMarkDone, onDelete }: {
  suggestions: Suggestion[];
  loading: boolean;
  onMarkDone: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  const visible = suggestions.filter(s => filter === "all" || s.status === filter);

  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Suggestions</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Feature requests and ideas from your members.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["pending", "done", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all capitalize ${
              filter === f
                ? f === "pending"
                  ? "bg-amber-100 text-amber-700 border-amber-200 shadow-sm scale-105"
                  : f === "done"
                  ? "bg-green-100 text-green-700 border-green-200 shadow-sm scale-105"
                  : "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                : "bg-background text-muted-foreground border-border hover:border-primary/30"
            }`}
          >
            {f} {f !== "all" && <span className="ml-1 opacity-70">({suggestions.filter(s => s.status === f).length})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lightbulb className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No {filter === "all" ? "" : filter} suggestions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(s => (
            <div key={s.id} className={`bg-card rounded-2xl border p-5 flex gap-4 items-start transition-colors ${
              s.status === "done" ? "border-green-200 bg-green-50/30 opacity-70" : "border-border"
            }`}>
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                {s.user?.profileImageUrl
                  ? <img src={s.user.profileImageUrl} alt="" className="w-full h-full object-cover" />
                  : (s.user?.displayName?.[0] ?? "?").toUpperCase()
                }
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">
                    {s.user?.displayName ?? s.user?.email ?? "Unknown user"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                  </span>
                  {s.status === "done" && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                      <CircleCheck className="w-3 h-3" /> Done
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">{s.body}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                {s.status === "pending" && (
                  <Button size="sm" variant="outline"
                    onClick={() => onMarkDone(s.id)}
                    className="rounded-xl h-8 px-3 text-xs font-bold text-green-700 border-green-200 hover:bg-green-50"
                  >
                    <CircleCheck className="w-3.5 h-3.5 mr-1" /> Done
                  </Button>
                )}
                <Button size="sm" variant="ghost"
                  onClick={() => onDelete(s.id)}
                  className="rounded-xl h-8 px-3 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
