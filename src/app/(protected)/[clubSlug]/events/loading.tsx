export default function EventsLoading() {
	return (
		<div className="space-y-6 animate-pulse">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="h-8 w-28 bg-muted" />
				<div className="flex gap-2">
					<div className="h-9 w-24 bg-muted" />
					<div className="h-9 w-32 bg-muted" />
				</div>
			</div>

			{/* Month label */}
			<div className="h-5 w-24 bg-muted" />

			{/* Event cards */}
			<div className="space-y-4">
				{[1, 2, 3, 4].map((i) => (
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
