import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import {
  env,
  hasExplicitFirebaseAdminCredentials,
  isFirebaseAdminConfigured,
} from "@/lib/env";

function getPrivateKey() {
  return env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function createFirebaseAdminApp(): App | null {
  if (!isFirebaseAdminConfigured) {
    return null;
  }

  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  const projectId = env.FIREBASE_PROJECT_ID ?? env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (hasExplicitFirebaseAdminCredentials) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: getPrivateKey(),
      }),
      projectId,
    });
  }

  if (projectId) {
    return initializeApp({ projectId });
  }

  return initializeApp();
}

export function getFirebaseAdminAuth() {
  const app = createFirebaseAdminApp();
  return app ? getAuth(app) : null;
}

export function getFirebaseAdminFirestore() {
  const app = createFirebaseAdminApp();
  return app ? getFirestore(app) : null;
}
