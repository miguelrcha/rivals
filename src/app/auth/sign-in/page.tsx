import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign in / Rivals",
  description: "Sign in to the rivals Pokémon speedrun league.",
};

export default function SignInPage() {
  return <SignInForm />;
}
