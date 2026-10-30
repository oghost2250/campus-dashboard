"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Crown,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/i18n/provider";
import { canManageRole, hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type {
  AdminStatsDTO,
  AdminUserDTO,
  AdminUsersResponse,
} from "@/lib/types";
import type { UserRole, UserStatus } from "@prisma/client";

type StatusFilter = "ALL" | UserStatus;
type RoleFilter = "ALL" | UserRole;
type UserPatch = { status?: UserStatus; role?: UserRole };

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "USER" as UserRole,
  status: "ACTIVE" as UserStatus,
};

function initials(user: AdminUserDTO) {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`
    .toUpperCase()
    .slice(0, 2);
}

function sortUsers(users: AdminUserDTO[]) {
  const order: Record<UserStatus, number> = {
    PENDING: 0,
    ACTIVE: 1,
    SUSPENDED: 2,
  };
  return [...users].sort(
    (a, b) =>
      order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt),
  );
}

export function AdminUsers({
  initialUsers,
  initialStats,
  initialHasMore = false,
  pageSize = 100,
  currentUserId,
  actorRole,
}: {
  initialUsers: AdminUserDTO[];
  initialStats: AdminStatsDTO;
  initialHasMore?: boolean;
  pageSize?: number;
  currentUserId: string;
  actorRole: UserRole;
}) {
  const { t, locale } = useI18n();

  const [users, setUsers] = useState(initialUsers);
  const [stats, setStats] = useState<AdminStatsDTO>(initialStats);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserDTO | null>(null);
  const [confirmChange, setConfirmChange] = useState<{
    user: AdminUserDTO;
    patch: UserPatch;
  } | null>(null);

  useEffect(() => setUsers(initialUsers), [initialUsers]);

  async function refreshStats() {
    try {
      const response = await fetch("/api/admin/users?page=1&pageSize=1", {
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { stats?: AdminStatsDTO };
      if (payload.stats) setStats(payload.stats);
    } catch {
      // Stats are cosmetic; a failed refresh should not surface an error.
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const response = await fetch(
        `/api/admin/users?page=${nextPage}&pageSize=${pageSize}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("FAILED");

      const payload = (await response.json()) as AdminUsersResponse;
      const incoming = payload.users ?? [];

      setUsers((current) => {
        const seen = new Set(current.map((item) => item.id));
        return sortUsers([
          ...current,
          ...incoming.filter((item) => !seen.has(item.id)),
        ]);
      });
      setPage(nextPage);
      setHasMore(Boolean(payload.hasMore));
      if (payload.stats) setStats(payload.stats);
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (statusFilter !== "ALL" && user.status !== statusFilter) return false;
      if (roleFilter !== "ALL" && user.role !== roleFilter) return false;
      if (!needle) return true;
      return `${user.name ?? ""} ${user.email}`.toLowerCase().includes(needle);
    });
  }, [users, query, statusFilter, roleFilter]);

  const statusLabel: Record<UserStatus, string> = {
    PENDING: t.admin.statusPending,
    ACTIVE: t.admin.statusActive,
    SUSPENDED: t.admin.statusSuspended,
  };

  const roleLabel: Record<UserRole, string> = {
    USER: t.admin.roleUser,
    ADMIN: t.admin.roleAdmin,
    SUPER_ADMIN: t.admin.roleSuperAdmin,
  };

  function errorMessage(code?: string) {
    switch (code) {
      case "LAST_ADMIN":
        return t.admin.errorLastAdmin;
      case "LAST_SUPER_ADMIN":
        return t.admin.errorLastSuperAdmin;
      case "SELF_ROLE":
      case "SELF_STATUS":
      case "SELF_DELETE":
        return t.admin.errorSelf;
      case "SUPER_ADMIN_ONLY":
        return t.admin.errorSuperAdminOnly;
      case "SUPER_ADMIN_PROMOTION_ONLY":
        return t.admin.errorPromotionOnly;
      case "EMAIL_UNVERIFIED":
        return t.admin.errorEmailUnverified;
      case "PROTECTED_ACCOUNT":
        return t.admin.errorProtected;
      case "EMAIL_TAKEN":
        return t.admin.errorEmailTaken;
      case "VALIDATION_ERROR":
        return t.admin.errorValidation;
      default:
        return t.common.error;
    }
  }

  function toastForPatch(user: AdminUserDTO, patch: UserPatch) {
    if (patch.role === "SUPER_ADMIN") return t.admin.superPromotedToast;
    if (patch.role === "ADMIN") return t.admin.promotedToast;
    if (patch.role === "USER") {
      return user.role === "SUPER_ADMIN"
        ? t.admin.superDemotedToast
        : t.admin.demotedToast;
    }
    if (patch.status === "SUSPENDED") return t.admin.suspendedToast;
    if (patch.status === "ACTIVE") {
      return user.status === "SUSPENDED"
        ? t.admin.reactivatedToast
        : t.admin.approvedToast;
    }
    return t.common.saved;
  }

  function confirmBody() {
    if (!confirmChange) return "";
    if (confirmChange.patch.status === "SUSPENDED") return t.admin.confirmSuspend;
    if (confirmChange.patch.role === "SUPER_ADMIN") return t.admin.confirmSuper;
    if (confirmChange.patch.role === "ADMIN") return t.admin.confirmPromote;
    if (confirmChange.patch.role === "USER") return t.admin.confirmDemote;
    return t.admin.confirmChange;
  }

  async function patchUser(user: AdminUserDTO, patch: UserPatch) {
    setPendingId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await response.json().catch(() => null)) as
        | { user?: AdminUserDTO; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? "FAILED");
      }

      const updated = payload.user;
      setUsers((current) =>
        sortUsers(current.map((item) => (item.id === updated.id ? updated : item))),
      );
      toast.success(toastForPatch(user, patch));
      void refreshStats();
    } catch (error) {
      toast.error(errorMessage(error instanceof Error ? error.message : undefined));
    } finally {
      setPendingId(null);
    }
  }

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as
        | { user?: AdminUserDTO; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        setFormError(errorMessage(payload?.error));
        return;
      }

      setUsers((current) => sortUsers([payload.user as AdminUserDTO, ...current]));
      toast.success(t.admin.createdToast);
      setCreateOpen(false);
      setForm(emptyForm);
      void refreshStats();
    } catch {
      setFormError(t.common.error);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setPendingId(target.id);

    try {
      const response = await fetch(`/api/admin/users/${target.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) throw new Error(payload?.error ?? "FAILED");

      setUsers((current) => current.filter((item) => item.id !== target.id));
      toast.success(t.admin.deletedToast);
      void refreshStats();
    } catch (error) {
      toast.error(errorMessage(error instanceof Error ? error.message : undefined));
    } finally {
      setPendingId(null);
    }
  }

  const statCards = [
    {
      key: "total",
      label: t.admin.statsTotal,
      value: stats.total,
      icon: Users,
      tone: "text-foreground",
      chip: "bg-muted text-muted-foreground",
    },
    {
      key: "pending",
      label: t.admin.statsPending,
      value: stats.pending,
      icon: Clock3,
      tone: "text-warning",
      chip: "bg-warning/12 text-warning",
    },
    {
      key: "active",
      label: t.admin.statsActive,
      value: stats.active,
      icon: CheckCircle2,
      tone: "text-success",
      chip: "bg-success/12 text-success",
    },
    {
      key: "admins",
      label: t.admin.statsAdmins,
      value: stats.admins,
      icon: ShieldCheck,
      tone: "text-primary",
      chip: "bg-primary/12 text-primary",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary">
              <ShieldCheck className="size-4.5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t.admin.title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.admin.subtitle}</p>
        </div>

        <Button
          onClick={() => {
            setForm(emptyForm);
            setFormError(null);
            setCreateOpen(true);
          }}
          className="h-9 shrink-0 rounded-xl"
        >
          <Plus className="size-4" />
          {t.admin.createUser}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-soft backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {card.label}
              </p>
              <span className={cn("grid size-7 place-items-center rounded-lg", card.chip)}>
                <card.icon className="size-3.5" />
              </span>
            </div>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", card.tone)}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70 shadow-soft backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.admin.searchPlaceholder}
              className="h-9 rounded-lg ps-9"
            />
          </div>

          <div className="flex gap-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.admin.allStatuses}</SelectItem>
                <SelectItem value="PENDING">{t.admin.statusPending}</SelectItem>
                <SelectItem value="ACTIVE">{t.admin.statusActive}</SelectItem>
                <SelectItem value="SUSPENDED">
                  {t.admin.statusSuspended}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={roleFilter}
              onValueChange={(value) => setRoleFilter(value as RoleFilter)}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t.admin.allRoles}</SelectItem>
                <SelectItem value="USER">{t.admin.roleUser}</SelectItem>
                <SelectItem value="ADMIN">{t.admin.roleAdmin}</SelectItem>
                <SelectItem value="SUPER_ADMIN">
                  {t.admin.roleSuperAdmin}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Users className="size-5" />
            </span>
            <p className="text-sm font-medium">
              {users.length === 0 ? t.admin.empty : t.admin.emptyFiltered}
            </p>
            {stats.pending > 0 ? (
              <p className="text-xs text-muted-foreground">{t.admin.pendingHint}</p>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            <AnimatePresence initial={false}>
              {filtered.map((user) => {
                const isSelf = user.id === currentUserId;
                const isSuper = user.role === "SUPER_ADMIN";
                const isAdmin = hasRole(user.role, "ADMIN");
                const canManage = !isSelf && canManageRole(actorRole, user.role);
                const canGrantAdmin =
                  canManage &&
                  user.status === "ACTIVE" &&
                  user.role === "USER" &&
                  hasRole(actorRole, "SUPER_ADMIN");
                const canGrantSuper =
                  canManage &&
                  user.status === "ACTIVE" &&
                  user.role === "ADMIN" &&
                  Boolean(user.emailVerified) &&
                  hasRole(actorRole, "SUPER_ADMIN");

                return (
                  <motion.li
                    key={user.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Avatar className="mt-0.5 size-9 shrink-0">
                        {user.image ? (
                          <AvatarImage src={user.image} alt="" />
                        ) : null}
                        <AvatarFallback className="bg-primary/12 text-[11px] font-semibold text-primary">
                          {initials(user)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-medium">
                            {user.name ?? user.email}
                          </p>
                          {isSelf ? (
                            <Badge variant="secondary">{t.admin.you}</Badge>
                          ) : null}
                          <Badge variant={isAdmin ? "default" : "outline"}>
                            {isSuper ? (
                              <Crown data-icon="inline-start" />
                            ) : isAdmin ? (
                              <ShieldCheck data-icon="inline-start" />
                            ) : (
                              <UserRound data-icon="inline-start" />
                            )}
                            {roleLabel[user.role]}
                          </Badge>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              user.status === "PENDING" &&
                                "bg-warning/12 text-warning",
                              user.status === "ACTIVE" &&
                                "bg-success/12 text-success",
                              user.status === "SUSPENDED" &&
                                "bg-destructive/10 text-destructive",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                user.status === "PENDING" && "bg-warning",
                                user.status === "ACTIVE" && "bg-success",
                                user.status === "SUSPENDED" && "bg-destructive",
                              )}
                            />
                            {statusLabel[user.status]}
                          </span>
                        </div>

                        <p className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground/80">
                          <span>
                            {t.admin.joined}{" "}
                            {formatDate(user.createdAt, locale, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {!user.emailVerified ? (
                            <span className="text-warning">
                              {t.admin.emailUnverified}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:ps-3">
                      {user.status === "PENDING" && canManage ? (
                        <Button
                          size="sm"
                          onClick={() => patchUser(user, { status: "ACTIVE" })}
                          disabled={pendingId === user.id}
                          className="rounded-lg"
                        >
                          {pendingId === user.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          {t.admin.approve}
                        </Button>
                      ) : null}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg opacity-70 transition-opacity group-hover:opacity-100"
                            aria-label={t.common.actions}
                            disabled={pendingId === user.id}
                          >
                            {pendingId === user.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="size-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {user.status === "SUSPENDED" && canManage ? (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => patchUser(user, { status: "ACTIVE" })}
                            >
                              <CheckCircle2 className="size-4" />
                              {t.admin.reactivate}
                            </DropdownMenuItem>
                          ) : null}

                          {user.status === "ACTIVE" && canManage ? (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                setConfirmChange({
                                  user,
                                  patch: { status: "SUSPENDED" },
                                })
                              }
                            >
                              <ShieldOff className="size-4" />
                              {t.admin.suspend}
                            </DropdownMenuItem>
                          ) : null}

                          {canGrantAdmin ? (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                setConfirmChange({
                                  user,
                                  patch: { role: "ADMIN" },
                                })
                              }
                            >
                              <ShieldCheck className="size-4" />
                              {t.admin.makeAdmin}
                            </DropdownMenuItem>
                          ) : null}

                          {canGrantSuper ? (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                setConfirmChange({
                                  user,
                                  patch: { role: "SUPER_ADMIN" },
                                })
                              }
                            >
                              <Crown className="size-4" />
                              {t.admin.makeSuperAdmin}
                            </DropdownMenuItem>
                          ) : null}

                          {canManage && user.role === "ADMIN" ? (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() =>
                                setConfirmChange({
                                  user,
                                  patch: { role: "USER" },
                                })
                              }
                            >
                              <UserRound className="size-4" />
                              {t.admin.removeAdmin}
                            </DropdownMenuItem>
                          ) : null}

                          {isSelf ? (
                            <DropdownMenuItem disabled>
                              <UserRound className="size-4" />
                              {t.admin.cannotEditSelf}
                            </DropdownMenuItem>
                          ) : null}

                          {!isSelf && !canManage ? (
                            <DropdownMenuItem disabled>
                              <ShieldCheck className="size-4" />
                              {t.admin.protectedAccount}
                            </DropdownMenuItem>
                          ) : null}

                          {canManage ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => setDeleteTarget(user)}
                              >
                                <Trash2 className="size-4" />
                                {t.admin.deleteUser}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        {hasMore ? (
          <div className="flex justify-center border-t border-border/60 p-4">
            <Button
              type="button"
              variant="outline"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-xl"
            >
              {loadingMore ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Users className="size-4" />
              )}
              {loadingMore ? t.common.loading : t.admin.loadMore}
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.admin.createTitle}</DialogTitle>
            <DialogDescription>{t.admin.createSubtitle}</DialogDescription>
          </DialogHeader>

          <form onSubmit={createUser} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-name">{t.admin.name}</Label>
              <Input
                id="admin-name"
                value={form.name}
                onChange={(event) =>
                  setForm((state) => ({ ...state, name: event.target.value }))
                }
                placeholder={t.admin.namePlaceholder}
                required
                autoFocus
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-email">{t.admin.email}</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((state) => ({ ...state, email: event.target.value }))
                }
                placeholder={t.admin.emailPlaceholder}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password">{t.admin.password}</Label>
              <Input
                id="admin-password"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((state) => ({ ...state, password: event.target.value }))
                }
                placeholder={t.auth.passwordPlaceholder}
                required
                minLength={8}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t.admin.role}</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) =>
                    setForm((state) => ({
                      ...state,
                      role: value as UserRole,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">{t.admin.roleUser}</SelectItem>
                    {hasRole(actorRole, "SUPER_ADMIN") ? (
                      <SelectItem value="ADMIN">{t.admin.roleAdmin}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.admin.status}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((state) => ({
                      ...state,
                      status: value as UserStatus,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t.admin.statusActive}</SelectItem>
                    <SelectItem value="PENDING">{t.admin.statusPending}</SelectItem>
                    <SelectItem value="SUSPENDED">
                      {t.admin.statusSuspended}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formError ? (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="rounded-xl"
              >
                {t.common.cancel}
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-xl"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t.admin.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.name ?? deleteTarget.email} — ${t.admin.deleteBody}`
                : t.admin.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(confirmChange)}
        onOpenChange={(open) => {
          if (!open) setConfirmChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.admin.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmChange
                ? `${confirmChange.user.name ?? confirmChange.user.email} — ${confirmBody()}`
                : t.admin.confirmChange}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const change = confirmChange;
                setConfirmChange(null);
                if (change) void patchUser(change.user, change.patch);
              }}
            >
              {t.common.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
