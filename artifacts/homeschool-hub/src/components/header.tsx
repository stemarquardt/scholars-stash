import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { LinkFormDialog } from "./link-form-dialog";

function OwlIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="w-6 h-6 md:w-7 md:h-7"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <ellipse
        cx="12"
        cy="14"
        rx="6"
        ry="7"
        fill="currentColor"
        opacity="0.18"
      />
      <ellipse
        cx="12"
        cy="14"
        rx="6"
        ry="7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Eyes */}
      <circle cx="9.5" cy="11" r="2" fill="currentColor" opacity="0.85" />
      <circle cx="14.5" cy="11" r="2" fill="currentColor" opacity="0.85" />
      <circle
        cx="9.5"
        cy="11"
        r="0.8"
        fill="currentColor"
        opacity="0.15"
        className="[fill:white]"
        style={{ fill: "white" }}
      />
      <circle
        cx="14.5"
        cy="11"
        r="0.8"
        fill="currentColor"
        opacity="0.15"
        className="[fill:white]"
        style={{ fill: "white" }}
      />
      {/* Beak */}
      <path
        d="M11 13l1 1.5L13 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
      {/* Ear tufts */}
      <path
        d="M9 7.5C9 6 8 5 7 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15 7.5C15 6 16 5 17 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Wings hint */}
      <path
        d="M6 15c-1.5 1-2 2.5-1.5 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M18 15c1.5 1 2 2.5 1.5 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Graduation cap */}
      <rect
        x="8.5"
        y="4.5"
        width="7"
        height="1.2"
        rx="0.4"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M12 4.5v-1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

export function Header() {
  const { user, isLoading, login, logout } = useAuth();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleLogout = () => {
    queryClient.clear();
    logout();
  };

  const displayLabel =
    user?.displayName ||
    user?.firstName ||
    user?.email?.split("@")[0] ||
    "User";
  const avatarInitial = (
    user?.firstName?.[0] ||
    user?.email?.[0] ||
    "U"
  ).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-background/90 backdrop-blur-xl border-b border-primary/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-md shadow-primary/30 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300">
                <OwlIcon />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl text-foreground tracking-tight leading-tight">
                  <span
                    style={{
                      fontFamily: "'Libre Baskerville', Georgia, serif",
                    }}
                    className="font-bold italic"
                  >
                    Scholars'
                  </span>{" "}
                  <span
                    style={{ fontFamily: "'Righteous', sans-serif" }}
                    className="text-accent"
                  >
                    Stash
                  </span>
                </h1>
                <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden sm:block">
                  Our Family's Favorite Resources
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-3 md:gap-4">
              {isLoading ? (
                <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
              ) : user ? (
                <>
                  {(user.isApproved || user.isAdmin) && (
                    <>
                      <Button
                        onClick={() => setIsAddModalOpen(true)}
                        className="hidden sm:flex rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add to Stash
                      </Button>

                      <Button
                        onClick={() => setIsAddModalOpen(true)}
                        size="icon"
                        className="sm:hidden rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      >
                        <Plus className="w-5 h-5" />
                      </Button>
                    </>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:scale-105 transition-transform">
                        <Avatar className="w-10 h-10 md:w-11 md:h-11 border-2 border-primary/30 shadow-sm">
                          <AvatarImage
                            src={user.profileImageUrl || undefined}
                          />
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                            {avatarInitial}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-56 rounded-2xl p-2 shadow-xl border-border/50"
                    >
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-bold leading-none">
                            {displayLabel}
                          </p>
                          {user.email && (
                            <p className="text-xs text-muted-foreground leading-none">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {user.isAdmin && (
                        <DropdownMenuItem
                          asChild
                          className="rounded-xl cursor-pointer py-2.5 font-semibold text-primary focus:bg-primary/10 focus:text-primary"
                        >
                          <Link href="/admin">
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            <span>Admin Panel</span>
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={handleLogout}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive rounded-xl cursor-pointer py-2.5 font-semibold"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <button
                  onClick={login}
                  className="inline-flex items-center justify-center whitespace-nowrap text-sm font-bold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 md:h-11 px-4 md:px-6 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  🦉 Join
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {isAddModalOpen && (
        <LinkFormDialog
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
        />
      )}
    </>
  );
}
