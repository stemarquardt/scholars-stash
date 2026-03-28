import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, AlertCircle, RefreshCw, Clock, LogOut } from "lucide-react";
import { 
  useListLinks, 
  useListTags,
  ListLinksSortBy 
} from "@workspace/api-client-react";
import type { LinkPriceRange } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Header } from "@/components/header";
import { LinkCard } from "@/components/link-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PRICE_RANGE_OPTIONS } from "@/lib/price-ranges";
import { SuggestionBox } from "@/components/suggestion-box";

export default function Home() {
  const { user, isLoading: isUserLoading, login } = useAuth();
  
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 500);
  const [selectedTags, setSelectedTags] = useState<Set<number>>(new Set());
  const [selectedPrice, setSelectedPrice] = useState<LinkPriceRange | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ListLinksSortBy>(ListLinksSortBy.newest);

  const tagsString = Array.from(selectedTags).join(",");
  
  const isAccessGranted = !isUserLoading && !!user && (user.isApproved || user.isAdmin);

  const {
    data: rawLinks = [],
    isLoading: isLinksLoading,
    isError,
    refetch
  } = useListLinks(
    {
      search: debouncedSearch || undefined,
      tags: tagsString || undefined,
      priceRange: selectedPrice || undefined,
      sortBy,
    },
    {
      query: {
        enabled: isAccessGranted,
        staleTime: 0,
        refetchOnWindowFocus: true,
        refetchInterval: isAccessGranted ? 15_000 : false,
      },
    }
  );

  const links = selectedFormat
    ? rawLinks.filter(l => (l as any).format === selectedFormat)
    : rawLinks;

  const { data: tags = [] } = useListTags({ query: { enabled: isAccessGranted } });

  const toggleTag = (tagId: number) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const clearFilters = () => {
    setSearchInput("");
    setSelectedTags(new Set());
    setSelectedPrice(null);
    setSelectedFormat(null);
    setSortBy(ListLinksSortBy.newest);
  };

  const hasActiveFilters = searchInput.length > 0 || selectedTags.size > 0 || selectedPrice !== null || selectedFormat !== null || sortBy !== ListLinksSortBy.newest;

  return (
    <div className="min-h-screen honeycomb-bg flex flex-col">
      <Header />

      <main className="flex-grow">
        {/* Hero Section — shown when not logged in */}
        {!isUserLoading && !user && (
          <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 border-b border-primary/20">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[-15%] left-[-5%] w-[500px] h-[500px] bg-primary/12 rounded-full blur-3xl" />
              <div className="absolute bottom-[-20%] right-[-5%] w-[450px] h-[450px] bg-accent/15 rounded-full blur-3xl" />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="max-w-2xl text-center lg:text-left">
                  <Badge className="mb-6 py-1.5 px-4 bg-primary/12 text-primary border-primary/25 font-bold tracking-widest rounded-full text-xs uppercase">
                    🦉 A Free-Range Community for Homeschoolers
                  </Badge>
                  <h1 className="text-5xl md:text-6xl leading-[1.1] tracking-tight mb-6">
                    <span style={{fontFamily:"'Righteous', sans-serif"}} className="text-primary">Roam</span>{" "}
                    <span className="font-bold text-foreground">the web.</span>
                    <br />
                    <span style={{fontFamily:"'Libre Baskerville', Georgia, serif"}} className="italic text-foreground font-bold">Stash</span>{" "}
                    <span className="font-bold text-foreground">what matters.</span>
                  </h1>
                  <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8">
                    A place for our family and friends to find, share, and save the best homeschool resources we've found across the web — all in one spot.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <button
                      onClick={login}
                      className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-xl shadow-primary/25 hover:shadow-2xl hover:bg-primary/90 hover:-translate-y-1 transition-all"
                    >
                      🦉 Join
                    </button>
                  </div>
                </div>
                <div className="hidden lg:flex items-center justify-center">
                  <div className="relative w-full max-w-[480px]">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-accent/15 rounded-3xl transform rotate-2 scale-105 border border-primary/15" />
                    <img 
                      src={`${import.meta.env.BASE_URL}images/owls.png`} 
                      alt="The Adventure Scholars owl family — studious and ready to explore" 
                      className="relative z-10 rounded-3xl shadow-2xl w-full h-auto border-4 border-white/80"
                    />
                    <div className="absolute -top-4 -right-4 w-20 h-20 bg-primary/20 rounded-full blur-xl z-20" />
                    <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-accent/25 rounded-full blur-xl z-20" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pending approval wall — shown for logged-in, unapproved non-admin users */}
        {!isUserLoading && user && !user.isApproved && !user.isAdmin && (
          <section className="flex-grow flex flex-col items-center justify-center px-4 py-24 text-center">
            <div className="bg-card rounded-3xl border-2 border-amber-200 shadow-lg max-w-lg w-full p-10 flex flex-col items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-4xl">
                🦉
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Awaiting Approval
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Hey, <span className="font-semibold text-foreground">{user.displayName || user.firstName || "friend"}</span>! You're in — we just need to give you the green light first. Stephen or Whitney will approve you soon. Hang tight!
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
                <Clock className="w-4 h-4" />
                Pending admin approval
              </div>
              <button
                onClick={() => fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => { window.location.href = "/"; })}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </section>
        )}

        {/* Logged-in welcome banner — only for approved users */}
        {!isUserLoading && user && (user.isApproved || user.isAdmin) && (
          <div className="bg-primary/8 border-b border-primary/15 py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-sm font-semibold text-primary">
                🦉 Back on the trail, {user.displayName || user.firstName || "explorer"}! Drop a gem into the Stash for your fellow adventurers.
              </p>
            </div>
          </div>
        )}

        {/* Main Browse Interface — only shown for approved/admin users */}
        {isAccessGranted && (
        <section id="browse" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          
          {/* Filter / Sort Bar */}
          <div className="bg-card rounded-3xl p-4 md:p-6 shadow-sm border border-primary/15 mb-10 sticky top-16 md:top-20 z-30">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-grow relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder="Search resources…" 
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 rounded-2xl bg-background border-2 border-border focus-visible:border-primary text-base"
                />
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-3 items-center shrink-0">
                <div className="flex items-center gap-2 bg-background border-2 border-border rounded-2xl px-4 h-14 w-full sm:w-auto">
                  <SlidersHorizontal className="w-5 h-5 text-muted-foreground shrink-0" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as ListLinksSortBy)}>
                    <SelectTrigger className="border-0 shadow-none focus:ring-0 px-0 h-auto font-bold text-foreground min-w-[140px]">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-xl">
                      <SelectItem value={ListLinksSortBy.newest} className="rounded-lg font-medium cursor-pointer">Newest First</SelectItem>
                      <SelectItem value={ListLinksSortBy.oldest} className="rounded-lg font-medium cursor-pointer">Oldest First</SelectItem>
                      <SelectItem value={ListLinksSortBy.most_reactions} className="rounded-lg font-medium cursor-pointer">Most Loved</SelectItem>
                      <SelectItem value={ListLinksSortBy.title} className="rounded-lg font-medium cursor-pointer">A–Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Subject filter row */}
            <div className="mt-5 pt-5 border-t border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filter by Subject</h3>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-xs font-bold text-primary hover:underline">
                    Clear All
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const isSelected = selectedTags.has(tag.id);
                  return (
                    <Badge 
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`
                        cursor-pointer px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2
                        ${isSelected 
                          ? "bg-primary text-primary-foreground border-primary shadow-md scale-105" 
                          : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:bg-primary/5"}
                      `}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Price filter row */}
            <div className="mt-4 pt-4 border-t border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filter by Price</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGE_OPTIONS.map(opt => {
                  const isSelected = selectedPrice === opt.value;
                  return (
                    <Badge
                      key={opt.value}
                      onClick={() => setSelectedPrice(isSelected ? null : opt.value)}
                      className={`
                        cursor-pointer px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2
                        ${isSelected
                          ? `${opt.color} border-current shadow-md scale-105`
                          : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:bg-primary/5"}
                      `}
                    >
                      {opt.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Format filter row */}
            <div className="mt-4 pt-4 border-t border-primary/10">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Filter by Format</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: "online",    label: "🌐 Online" },
                  { value: "in_person", label: "📍 In Person" },
                  { value: "physical",  label: "📦 Physical" },
                  { value: "blended",   label: "🔀 Blended" },
                ] as const).map(opt => {
                  const isSelected = selectedFormat === opt.value;
                  return (
                    <Badge
                      key={opt.value}
                      onClick={() => setSelectedFormat(isSelected ? null : opt.value)}
                      className={`
                        cursor-pointer px-3 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2
                        ${isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                          : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:bg-primary/5"}
                      `}
                    >
                      {opt.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Results heading */}
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">
              {isLinksLoading ? "Loading resources…" : `${links.length} resource${links.length !== 1 ? "s" : ""} found`}
            </h2>
          </div>

          {isError ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 bg-destructive/5 rounded-3xl border border-destructive/20 text-center">
              <AlertCircle className="w-16 h-16 text-destructive mb-4" />
              <h3 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h3>
              <p className="text-muted-foreground mb-6 max-w-md">Couldn't load the resources. Please try again.</p>
              <Button onClick={() => refetch()} variant="outline" className="rounded-xl h-12 px-6 font-bold border-2">
                <RefreshCw className="w-4 h-4 mr-2" /> Try Again
              </Button>
            </div>
          ) : isLinksLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                  <Skeleton className="h-48 w-full rounded-none" />
                  <div className="p-5 space-y-4">
                    <Skeleton className="h-6 w-3/4 rounded-lg" />
                    <Skeleton className="h-4 w-1/3 rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <div className="pt-4 flex justify-between items-center border-t border-border">
                      <div className="flex gap-2 items-center">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-3 w-24 rounded" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : links.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 bg-muted/30 rounded-3xl border-2 border-dashed border-primary/20 text-center">
              <div className="text-6xl mb-6">🦉</div>
              <h3 className="text-3xl font-bold text-foreground mb-3">No treasures found</h3>
              <p className="text-lg text-muted-foreground mb-8 max-w-md">
                {hasActiveFilters 
                  ? "Try adjusting your search or clearing some filters." 
                  : "The Stash is wide open! Be the first explorer to drop a gem in here."}
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} className="rounded-xl h-12 px-8 font-bold text-lg shadow-lg shadow-primary/20">
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              <AnimatePresence mode="popLayout">
                {links.map((link, i) => (
                  <LinkCard key={link.id} link={link} index={i} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
        )}
      </main>

      {isAccessGranted && <SuggestionBox />}

      <footer className="bg-card border-t border-primary/15 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-4xl mb-4">🦉</div>
          <h2 className="text-xl text-foreground mb-2">
            <span style={{fontFamily:"'Libre Baskerville', Georgia, serif"}} className="font-bold italic">Scholars'</span>{" "}
            <span style={{fontFamily:"'Righteous', sans-serif"}} className="text-accent font-normal">Stash</span>
          </h2>
          <p className="text-muted-foreground font-medium mb-6 max-w-md mx-auto">
A little corner of the internet made with love for our homeschool community.
          </p>
          <div className="text-sm text-muted-foreground/60 font-bold tracking-wider">
            Made with ❤️ by Stephen &amp; Whitney
          </div>
        </div>
      </footer>
    </div>
  );
}
