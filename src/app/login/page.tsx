import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <section className="py-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
