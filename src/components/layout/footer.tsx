import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40 pb-[calc(7rem+env(safe-area-inset-bottom))] xl:pb-0">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-6 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} teenager.my</p>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/terms-and-conditions" className="hover:text-foreground">
            Terms and Conditions
          </Link>
          <Link href="/privacy-policy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/community-guidelines" className="hover:text-foreground">
            Community Guidelines
          </Link>
        </nav>
      </div>
    </footer>
  );
}
