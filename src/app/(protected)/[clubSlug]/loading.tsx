export default function Loading() {
	return (
		<div className="space-y-4 animate-pulse">
			<div className="h-7 w-32 bg-muted" />
			<div className="h-10 w-48 bg-muted" />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<div key={i} className="border bg-card overflow-hidden">
						<div className="h-24 bg-muted" />
						<div className="p-5 space-y-3">
							<div className="h-4 w-3/4 bg-muted" />
							<div className="h-3 w-1/2 bg-muted" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
