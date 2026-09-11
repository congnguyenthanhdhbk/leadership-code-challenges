import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-fg-muted">Nothing lives at this address.</p>
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        Back to the overview
      </Link>
    </div>
  );
}
