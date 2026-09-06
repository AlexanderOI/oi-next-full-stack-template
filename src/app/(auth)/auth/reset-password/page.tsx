import { PasswordResetForm } from "@/features/auth/client";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token, error } = await searchParams;
  const validToken =
    typeof token === "string" && token.length > 0 && error === undefined ? token : null;

  return <PasswordResetForm token={validToken} />;
}
