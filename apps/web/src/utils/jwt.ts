export const getUserIdFromToken = (token: string | null): string | null => {
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null; // use 'sub' instead of 'userId'
  } catch {
    return null;
  }
};
