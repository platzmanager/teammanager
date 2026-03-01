"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	MouseSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Search } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import {
	getFilteredPlayers,
	getRegistrations,
	type PaginatedPlayers,
	rebalancePositions,
	reorderPlayer,
	toggleRegistration,
} from "@/actions/players";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { isManuallySortable, sortPlayers } from "@/lib/players";
import { createClient } from "@/lib/supabase/client";
import {
	type AgeClass,
	GENDER_LABELS,
	type Gender,
	type Player,
} from "@/lib/types";
import { AgeClassTabs } from "./age-class-tabs";
import { PlayerChart } from "./player-chart";
import { PlayerForm } from "./player-form";
import { SortableRow } from "./sortable-row";

interface PlayerTableProps {
	gender: Gender;
	ageClass: AgeClass;
	initialData: PaginatedPlayers;
	isAdmin?: boolean;
	allowedAgeClasses?: AgeClass[];
	clubId?: string;
}

export function PlayerTable({
	gender,
	ageClass,
	initialData,
	isAdmin = false,
	allowedAgeClasses,
	clubId,
}: PlayerTableProps) {
	const [data, setData] = useState<PaginatedPlayers>(initialData);
	const [registeredUuids, setRegisteredUuids] = useState<Set<string>>(
		new Set(),
	);
	const [hideDeleted, setHideDeleted] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const ageClassMin = ageClass !== "offen" ? parseInt(ageClass, 10) : 0;
	const [ageRange, setAgeRange] = useState<[number, number]>([
		ageClassMin,
		100,
	]);
	const [page, setPage] = useState(1);
	const [allPlayers, setAllPlayers] = useState<Player[]>(initialData.players);
	const [hasMore, setHasMore] = useState(
		initialData.page < initialData.totalPages,
	);
	const loadMoreRef = useRef<HTMLDivElement>(null);
	const suppressRealtime = useRef(false);
	const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);
	const [isSaving, setIsSaving] = useState(false);

	// Reset age range when age class changes (e.g. switching tabs)
	useEffect(() => {
		setAgeRange([ageClassMin, 100]);
	}, [ageClassMin]);
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
		}),
	);

	// Fetch with current filters
	const fetchPlayers = useCallback(
		(overrides?: {
			page?: number;
			search?: string;
			hideDeleted?: boolean;
			ageRange?: [number, number];
			append?: boolean;
		}) => {
			const s = overrides?.search ?? searchQuery;
			const hd = overrides?.hideDeleted ?? hideDeleted;
			const ar = overrides?.ageRange ?? ageRange;
			const p = overrides?.page ?? page;
			const append = overrides?.append ?? false;

			startTransition(async () => {
				const result = await getFilteredPlayers({
					gender,
					search: s || undefined,
					ageClass,
					hideDeleted: hd,
					minAge: ar[0] > ageClassMin ? ar[0] : undefined,
					maxAge: ar[1] < 100 ? ar[1] : undefined,
					page: p,
					pageSize: 50,
				});
				setData(result);
				if (append) {
					setAllPlayers((prev) => {
						const existing = new Set(prev.map((p) => p.uuid));
						return [
							...prev,
							...result.players.filter((p) => !existing.has(p.uuid)),
						];
					});
				} else {
					setAllPlayers(result.players);
				}
				setHasMore(result.page < result.totalPages);
			});
		},
		[gender, ageClass, searchQuery, hideDeleted, ageRange, page],
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

	const handleAgeRangeChange = (value: number[]) => {
		const range: [number, number] = [value[0], value[1]];
		setAgeRange(range);
		setPage(1);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			fetchPlayers({ ageRange: range, page: 1 });
		}, 300);
	};

	const handleHideDeletedChange = (value: boolean) => {
		setHideDeleted(value);
		setPage(1);
		fetchPlayers({ hideDeleted: value, page: 1 });
	};

	const loadMore = useCallback(() => {
		if (isPending || !hasMore) return;
		const nextPage = page + 1;
		setPage(nextPage);
		fetchPlayers({ page: nextPage, append: true });
	}, [isPending, hasMore, page, fetchPlayers]);

	// Intersection observer for infinite scroll
	useEffect(() => {
		const el = loadMoreRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting) loadMore();
			},
			{ rootMargin: "200px" },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [loadMore]);

	// Refresh all currently loaded data in-place (preserves scroll position)
	const doRefresh = useCallback(() => {
		startTransition(async () => {
			const result = await getFilteredPlayers({
				gender,
				search: searchQuery || undefined,
				ageClass,
				hideDeleted,
				minAge: ageRange[0] > ageClassMin ? ageRange[0] : undefined,
				maxAge: ageRange[1] < 100 ? ageRange[1] : undefined,
				page: 1,
				pageSize: page * 50,
			});
			setData(result);
			setAllPlayers(result.players);
			setHasMore(result.page < result.totalPages);
		});
	}, [gender, ageClass, searchQuery, hideDeleted, ageRange, ageClassMin, page]);

	// Debounced refresh for realtime events — coalesces rapid-fire events into one
	const realtimeRefresh = useCallback(() => {
		if (suppressRealtime.current) return;
		if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
		realtimeDebounceRef.current = setTimeout(doRefresh, 500);
	}, [doRefresh]);

	const refreshRegistrations = useCallback(async () => {
		const uuids = await getRegistrations(gender, ageClass);
		setRegisteredUuids(new Set(uuids));
	}, [gender, ageClass]);

	useEffect(() => {
		setData(initialData);
		setAllPlayers(initialData.players);
		setHasMore(initialData.page < initialData.totalPages);
		setPage(1);
	}, [initialData]);

	useEffect(() => {
		refreshRegistrations();
	}, [refreshRegistrations]);

	// Realtime subscriptions
	const supabase = useMemo(() => createClient(), []);

	useEffect(() => {
		const channelName = clubId ? `players-${gender}-${clubId}` : `players-${gender}`;
		const channel = supabase
			.channel(channelName)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "players",
					filter: clubId ? `gender=eq.${gender},club_id=eq.${clubId}` : `gender=eq.${gender}`,
				},
				() => {
					realtimeRefresh();
				},
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "player_registrations",
					filter: `gender=eq.${gender}`,
				},
				() => {
					refreshRegistrations();
				},
			)
			.subscribe();

		return () => {
			if (realtimeDebounceRef.current)
				clearTimeout(realtimeDebounceRef.current);
			supabase.removeChannel(channel);
		};
	}, [supabase, gender, realtimeRefresh, refreshRegistrations]);

	const players = allPlayers;
	const showRegistration = true;

	async function handleToggleRegistration(
		playerUuid: string,
		registered: boolean,
	) {
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
			`${player.first_name} ${player.last_name}`,
		);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id) return;

		const oldIndex = players.findIndex((p) => p.uuid === active.id);
		const newIndex = players.findIndex((p) => p.uuid === over.id);

		const draggedPlayer = players[oldIndex];
		const targetPlayer = players[newIndex];

		if (
			!isManuallySortable(draggedPlayer, players) ||
			!isManuallySortable(targetPlayer, players)
		) {
			return;
		}

		if (
			draggedPlayer.skill_level != null &&
			targetPlayer.skill_level != null &&
			draggedPlayer.skill_level <= 20 &&
			targetPlayer.skill_level <= 20 &&
			draggedPlayer.skill_level !== targetPlayer.skill_level
		) {
			return;
		}

		// Compute new position from local neighbors
		const reordered = [...players];
		const [removed] = reordered.splice(oldIndex, 1);
		reordered.splice(newIndex, 0, removed);

		const insertedAt = newIndex;
		const prev = insertedAt > 0 ? reordered[insertedAt - 1] : null;
		const next =
			insertedAt < reordered.length - 1 ? reordered[insertedAt + 1] : null;

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

		// Optimistic local update — reorder the array and skip the realtime refresh
		suppressRealtime.current = true;
		setAllPlayers((current) => {
			const updated = current.map((p) =>
				p.uuid === draggedPlayer.uuid ? { ...p, sort_position: newPos } : p,
			);
			return sortPlayers(updated);
		});

		// Fire server updates in the background
		setIsSaving(true);
		const save = async () => {
			const gap =
				prev && next
					? Math.abs(next.sort_position - prev.sort_position)
					: Infinity;
			if (gap < 1) {
				await rebalancePositions(gender);
			}
			await reorderPlayer(draggedPlayer.uuid, gender, newPos);
			suppressRealtime.current = false;
			setIsSaving(false);
			doRefresh();
		};
		save();
	}

	const genderLabel = GENDER_LABELS[gender];
	const isFiltering =
		ageRange[0] > 0 || ageRange[1] < 100 || searchQuery || hideDeleted;

	return (
		<div className="space-y-4">
			{/* Header row */}
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">Meldeliste {genderLabel}</h2>
				<div className="flex items-center gap-2">
					{isPending && (
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					)}
					<PlayerForm gender={gender} onDone={doRefresh} isAdmin={isAdmin} />
				</div>
			</div>

			{/* Age class tabs (admin only) */}
			{allowedAgeClasses && (
				<AgeClassTabs
					gender={gender}
					current={ageClass}
					allowed={allowedAgeClasses}
				/>
			)}

			{/* Chart (admin only) */}
			{isAdmin && (
				<PlayerChart
					gender={gender}
					ageClass={ageClass}
					minAge={ageRange[0] > ageClassMin ? ageRange[0] : undefined}
					maxAge={ageRange[1] < 100 ? ageRange[1] : undefined}
					hideDeleted={hideDeleted}
				/>
			)}

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-white px-4 py-3">
				<div className="relative">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Name suchen…"
						value={searchQuery}
						onChange={(e) => handleSearchChange(e.target.value)}
						className="w-48 pl-8"
					/>
				</div>
				<div className="flex items-center gap-3">
					<Label className="text-sm text-muted-foreground whitespace-nowrap">
						Alter
					</Label>
					<Slider
						min={ageClassMin}
						max={100}
						step={10}
						value={ageRange}
						onValueChange={handleAgeRangeChange}
						className="w-36"
					/>
					<span className="min-w-[4ch] text-sm tabular-nums text-muted-foreground">
						{ageRange[0] === ageClassMin && ageRange[1] === 100
							? "Alle"
							: `${ageRange[0]}–${ageRange[1]}`}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Switch
						id="hide-deleted"
						checked={hideDeleted}

						onCheckedChange={handleHideDeletedChange}
					/>
					<Label htmlFor="hide-deleted" className="text-sm">
						Gelöschte ausblenden
					</Label>
				</div>
			</div>

			<div
				className={`rounded-md border bg-white transition-opacity ${isSaving ? "pointer-events-none opacity-50 delay-250 duration-200" : "delay-0 duration-0"}`}
			>
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
										<td
											colSpan={showRegistration ? 9 : 8}
											className="py-8 text-center text-muted-foreground"
										>
											Keine Spieler gefunden
										</td>
									</TableRow>
								) : (
									players.map((player, index) => (
										<SortableRow
											key={player.uuid}
											player={player}
											gender={gender}
											index={index}
											isDraggable={isManuallySortable(player, players)}
											onRefresh={doRefresh}
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

			{/* Infinite scroll sentinel */}
			<div ref={loadMoreRef} className="flex justify-center py-4">
				{isPending && hasMore && (
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
				)}
				{!hasMore && allPlayers.length > 0 && (
					<p className="text-sm text-muted-foreground">{data.total} Spieler</p>
				)}
			</div>
		</div>
	);
}
