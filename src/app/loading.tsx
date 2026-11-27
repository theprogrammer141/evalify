import { Spinner } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6">
      <Spinner className="text-sm text-muted-foreground" label="Loading page" />
    </main>
  );
}
