import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { unsealData } from 'iron-session';
import { sessionOptions, type SessionData } from './session';

export async function readServerSession() {
  const sealed = cookies().get(sessionOptions.cookieName)?.value;
  if (!sealed) return null;

  try {
    return await unsealData<SessionData>(sealed, {
      password: sessionOptions.password,
    });
  } catch {
    return null;
  }
}

export async function requireAdminOnServer() {
  const session = await readServerSession();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/admin/login');
  }
  return session.user;
}
