"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Player, Gender, AgeClass } from "@/lib/types";
import { sortPlayers, isManuallySortable } from "@/lib/players";
import {
  getPlayers,
  getFilteredPlayers,
  reorderPlayer,
  rebalancePositions,
  getRegistrations,
  toggleRegistration,
  PaginatedPlayers,
} from "@/actions/players";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SortableRow } from "./sortable-row";
import { PlayerForm } from "./player-form";
import { AgeClassTabs } from "./age-class-tabs";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PlayerTableProps {
  gender: Gender;
  initialData: PaginatedPlayers;
  isAdmin?: boolean;
}

export function PlayerTable({ gender, initialData, isAdmin = false }: PlayerTableProps) {
  const [data, setData] = useState<PaginatedPlayers>(initialData);
  const [ageClass, setAgeClass] = useState<AgeClass>("offen");
  const [registeredUuids, setRegisteredUuids] = useState<Set<string>>(new Set());
  const [hideDeleted, setHideDeleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch with current filters
  const fetchPlayers = useCallback(
    (overrides?: { page?: number; search?: string; ageClass?: AgeClass; hideDeleted?: boolean; maxAge?: string }) => {
      const s = overrides?.search ?? searchQuery;
      const ac = overrides?.ageClass ?? ageClass;
      const hd = overrides?.hideDeleted ?? hideDeleted;
      const ma = overrides?.maxAge ?? maxAge;
      const p = overrides?.page ?? page;

      startTransition(async () => {
        const result = await getFilteredPlayers({
          gender,
          search: s || undefined,
          ageClass: ac,
          hideDeleted: hd,
          maxAge: ma ? parseInt(ma, 10) : undefined,
          page: p,
          pageSize: 50,
        });
        setData(result);
      });
    },
    [gender, searchQuery, ageClass, hideDeleted, maxAge, page]
  );

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPlayers({ search: value, page: 1 });
    }, 300);
  };

  const handleMaxAgeChange = (value: string) => {
    setMaxAge(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPlayers({ maxAge: value, page: 1 });
    }, 300);
  };

  const handleAgeClassChange = (value: AgeClass) => {
    setAgeClass(value);
    setPage(1);
    fetchPlayers({ ageClass: value, page: 1 });
  };

  const handleHideDeletedChange = (value: boolean) => {
    setHideDeleted(value);
    setPage(1);
    fetchPlayers({ hideDeleted: value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchPlayers({ page: newPage });
  };

  // Refresh keeping current filters
  const refresh = useCallback(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const refreshRegistrations = useCallback(async () => {
    const uuids = await getRegistrations(gender, ageClass);
    setRegisteredUuids(new Set(uuids));
  }, [gender, ageClass]);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    refreshRegistrations();
  }, [refreshRegistrations]);

  // Realtime subscriptions
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`players-${gender}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `gender=eq.${gender}` },
        () => { refresh(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_registrations", filter: `gender=eq.${gender}` },
        () => { refreshRegistrations(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, gender, refresh, refreshRegistrations]);

  const players = data.players;
  const showRegistration = true;

  async function handleToggleRegistration(playerUuid: string, registered: boolean) {
    const player = players.find((p) => p.uuid === playerUuid);
    if (!player) return;

    setRegisteredUuids((prev) => {
      const next = new Set(prev);
      if (registered) next.add(playerUuid);
      else next.delete(playerUuid);
      return next;
    });

    await toggleRegistration(
      playerUuid,
      ageClass,
      gender,
      registered,
      `${player.first_name} ${player.last_name}`
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sorted = players;
    const oldIndex = sorted.findIndex((p) => p.uuid === active.id);
    const newIndex = sorted.findIndex((p) => p.uuid === over.id);

    const draggedPlayer = sorted[oldIndex];
    const targetPlayer = sorted[newIndex];

    if (!isManuallySortable(draggedPlayer, sorted) || !isManuallySortable(targetPlayer, sorted)) {
      return;
    }

    if (draggedPlayer.skill_level != null && targetPlayer.skill_level != null && draggedPlayer.skill_level <= 20 && targetPlayer.skill_level <= 20 && draggedPlayer.skill_level !== targetPlayer.skill_level) {
      return;
    }

    // For drag-and-drop, we need the full sorted list to compute positions
    const allData = await getPlayers(gender);
    const allSorted = sortPlayers(allData);
    const allOldIndex = allSorted.findIndex((p) => p.uuid === active.id);
    const allNewIndex = allSorted.findIndex((p) => p.uuid === over.id);

    const allNew = [...allSorted];
    const [removed] = allNew.splice(allOldIndex, 1);
    allNew.splice(allNewIndex, 0, removed);

    const insertedAt = allNew.findIndex((p) => p.uuid === active.id);
    const prev = insertedAt > 0 ? allNew[insertedAt - 1] : null;
    const next = insertedAt < allNew.length - 1 ? allNew[insertedAt + 1] : null;

    let newPos: number;
    if (prev && next) {
      newPos = (prev.sort_position + next.sort_position) / 2;
    } else if (prev) {
      newPos = prev.sort_position + 100;
    } else if (next) {
      newPos = next.sort_position - 100;
    } else {
      newPos = 100;
    }

    // Optimistic local update
    setData((prev) => ({
      ...prev,
      players: prev.players.map((p) =>
        p.uuid === draggedPlayer.uuid ? { ...p, sort_position: newPos } : p
      ),
    }));

    const gap = prev && next ? Math.abs(next.sort_position - prev.sort_position) : Infinity;
    if (gap < 1) {
      await rebalancePositions(gender);
    }

    await reorderPlayer(draggedPlayer.uuid, gender, newPos);

    // Refresh to get correct server state
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AgeClassTabs value={ageClass} onChange={handleAgeClassChange} />
        <PlayerForm gender={gender} onDone={refresh} />
      </div>
      <div className="flex items-center gap-4">
        <Input
          placeholder="Name suchen…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-48"
        />
        <Input
          type="number"
          placeholder="Max. Alter"
          value={maxAge}
          onChange={(e) => handleMaxAgeChange(e.target.value)}
          className="w-28"
          min={1}
        />
        <div className="flex items-center gap-2">
          <Switch id="hide-deleted" checked={hideDeleted} onCheckedChange={handleHideDeletedChange} />
          <Label htmlFor="hide-deleted">Gelöschte ausblenden</Label>
        </div>
        {isPending && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>

      <div className="rounded-md border bg-white">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={players.map((p) => p.uuid)}
            strategy={verticalListSortingStrategy}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  {showRegistration && (
                    <TableHead className="w-10 text-center">Gemeldet</TableHead>
                  )}
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Geb.datum</TableHead>
                  <TableHead className="text-center">Alter</TableHead>
                  <TableHead className="text-center">LK</TableHead>
                  <TableHead>Lizenz</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.length === 0 ? (
                  <TableRow>
                    <td colSpan={showRegistration ? 9 : 8} className="py-8 text-center text-muted-foreground">
                      Keine Spieler gefunden
                    </td>
                  </TableRow>
                ) : (
                  players.map((player, index) => (
                    <SortableRow
                      key={player.uuid}
                      player={player}
                      gender={gender}
                      index={(data.page - 1) * data.pageSize + index}
                      isDraggable={isManuallySortable(player, players)}
                      onRefresh={refresh}
                      showRegistration={showRegistration}
                      isRegistered={registeredUuids.has(player.uuid)}
                      onToggleRegistration={handleToggleRegistration}
                      isDeleted={!!player.deleted_at}
                      isAdmin={isAdmin}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </SortableContext>
        </DndContext>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {((data.page - 1) * data.pageSize) + 1}–{Math.min(data.page * data.pageSize, data.total)} von {data.total} Spielern
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={data.page <= 1 || isPending}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page - 1)}
              disabled={data.page <= 1 || isPending}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {pageNumbers(data.page, data.totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === data.page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(p as number)}
                  disabled={isPending}
                  className="h-8 w-8 p-0 text-xs"
                >
                  {p}
                </Button>
              )
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.page + 1)}
              disabled={data.page >= data.totalPages || isPending}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.totalPages)}
              disabled={data.page >= data.totalPages || isPending}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
