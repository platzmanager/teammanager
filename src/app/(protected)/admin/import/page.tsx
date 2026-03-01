import { requireAdmin } from "@/lib/auth";
import { CsvImport } from "@/components/csv-import";

export default async function ImportPage() {
  await requireAdmin();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">CSV Import</h2>
      <CsvImport />
    </div>
  );
}
