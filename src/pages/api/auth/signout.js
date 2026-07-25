// With `output: 'static'` configured:
export const prerender = false;

export const GET = async ({ cookies, redirect }) => {
  cookies.delete("sb-access-token", { path: "/" });
  cookies.delete("sb-refresh-token", { path: "/" });
  return redirect("/signin");
};