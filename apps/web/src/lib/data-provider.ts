"use client";

import {
  createFirebaseProvider,
  type DataProvider,
  type FirebaseClientConfig,
} from "@munhub/data-provider";

let providerPromise: Promise<DataProvider> | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function firebaseConfigFromEnv(): FirebaseClientConfig {
  const config: FirebaseClientConfig = {
    target: "client",
    apiKey: requiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requiredEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    databaseURL: requiredEnv("NEXT_PUBLIC_FIREBASE_DATABASE_URL"),
    projectId: requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  };

  const storageBucket = process.env["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"];
  if (storageBucket != null && storageBucket.trim() !== "") {
    config.storageBucket = storageBucket;
  }

  const messagingSenderId = process.env["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"];
  if (messagingSenderId != null && messagingSenderId.trim() !== "") {
    config.messagingSenderId = messagingSenderId;
  }

  const appId = process.env["NEXT_PUBLIC_FIREBASE_APP_ID"];
  if (appId != null && appId.trim() !== "") {
    config.appId = appId;
  }

  return config;
}

export function getDataProvider(): Promise<DataProvider> {
  if (providerPromise == null) {
    const activeProvider = process.env["NEXT_PUBLIC_ACTIVE_PROVIDER"] ?? "firebase";
    if (activeProvider !== "firebase") {
      throw new Error(`Unsupported active provider: ${activeProvider}`);
    }
    providerPromise = createFirebaseProvider(firebaseConfigFromEnv());
  }
  return providerPromise;
}
