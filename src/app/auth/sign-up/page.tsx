import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Sign up / Rivals",
  description: "Create an account for the rivals Pokémon speedrun league.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
