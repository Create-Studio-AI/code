import { authStore } from '~/lib/stores/authStore';
import { profileStore, updateProfile } from '~/lib/stores/profile';
import { checkDriveSpace } from '~/lib/services/drive';

const CS_USER_KEY = 'cs_user';

export interface DriveUser {
  email: string;
  name?: string;
}

const saveUser = (user: DriveUser) => {
  localStorage.setItem(CS_USER_KEY, JSON.stringify(user));

  authStore.setKey('user', user);

  if (user.name) {
    updateProfile({ username: user.name });
  }
};

const validateSsoToken = async (token: string, source: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/sso-validate-token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, source }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json<{ valid?: boolean; success?: boolean }>();

    return data?.valid !== false && data?.success !== false;
  } catch (err) {
    console.log('SSO token validation error', err);
    return false;
  }
};

export const loadUserFromStorage = (): DriveUser | null => {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const raw = localStorage.getItem(CS_USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DriveUser;
  } catch {
    return null;
  }
};

export const bootstrapDriveAuth = async () => {
  authStore.setKey('isLoading', true);

  // 1. Capture email/name from query params if present, once the SSO token is validated
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const name = params.get('name');
    const token = params.get('token');
    const source = params.get('source');

    if (email && token && source) {
      const isTokenValid = await validateSsoToken(token, source);

      if (isTokenValid) {
        saveUser({ email, name: name || undefined });
      } else {
        authStore.setKey('error', 'Invalid or expired login token');
      }

      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  const user = loadUserFromStorage();

  if (!user) {
    authStore.setKey('user', null);
    authStore.setKey('hasAccess', false);
    authStore.setKey('isLoading', false);

    return;
  }

  authStore.setKey('user', user);

  if (!profileStore.get().username && user.name) {
    updateProfile({ username: user.name });
  }

  try {
    const hasSpace = await checkDriveSpace(user.email);
    authStore.setKey('hasAccess', hasSpace);
  } catch (err: any) {
    authStore.setKey('error', err.message || 'Failed to verify storage');
    authStore.setKey('hasAccess', false);
  } finally {
    authStore.setKey('isLoading', false);
  }
};

export const updateToken = async (inputData: { email: string; model: string; total_used_tokens: number }) => {
  try {
    const response = await fetch('/api/billing', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(inputData),
    });

    if (!response.ok) {
      throw new Error('Billing request failed');
    }
  } catch (error) {
    console.log('error', error);
  }
};
