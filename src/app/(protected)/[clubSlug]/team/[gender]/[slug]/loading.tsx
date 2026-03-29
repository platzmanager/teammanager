export default function TeamDetailLoading() {
	return (
		<div className="animate-pulse">
			{/* Back link */}
			<div className="h-5 w-16 bg-muted" />

			{/* Team name */}
			<div className="mt-2 h-9 w-48 bg-muted" />

			{/* Tabs */}
			<div className="mt-6 flex gap-6 border-b">
				<div className="h-9 w-20 bg-muted" />
				<div className="h-9 w-24 bg-muted" />
				<div className="h-9 w-20 bg-muted" />
			</div>

			{/* Header row */}
			<div className="mt-6 flex items-center justify-between">
				<div className="h-7 w-32 bg-muted" />
				<div className="h-9 w-32 bg-muted" />
			</div>

			{/* Event cards */}
			<div className="mt-4 space-y-4">
				{[1, 2, 3].map((i) => (
					<div key={i} className="flex gap-4">
						<div className="h-20 w-16 bg-muted" />
						<div className="flex-1 space-y-2 py-1">
							<div className="h-5 w-3/4 bg-muted" />
							<div className="h-4 w-1/2 bg-muted" />
							<div className="mt-2 flex gap-2">
								<div className="h-9 w-20 bg-muted" />
								<div className="h-9 w-20 bg-muted" />
								<div className="h-9 w-20 bg-muted" />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
